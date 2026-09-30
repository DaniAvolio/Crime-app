import { NgClass } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LeafletDirective } from '@bluehalo/ngx-leaflet';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import {
  Circle,
  circle,
  divIcon,
  LatLng,
  latLng,
  layerGroup,
  Map as LeafletMap,
  MaplibreGL,
  MapOptions,
  Marker,
  MarkerCluster,
  MarkerClusterGroup,
  MarkerClusterGroupOptions,
  MarkerOptions,
  marker,
  DomUtil,
  Point,
  point,
} from 'leaflet';
// Estende l'oggetto globale L di Leaflet (il bundle UMD di Leaflet 1.9 lo espone sempre).
import 'leaflet.markercluster';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { ExpressionSpecification, setWorkerUrl } from 'maplibre-gl';
import { Subject, catchError, debounceTime, finalize, of, switchMap, tap } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth/auth';
import { CategorieStore } from '../categorie/categorie-store';
import { NomeCategoriaPipe } from '../categorie/nome-categoria.pipe';
import { SegnalazioneApi } from '../gestione/segnalazioni/segnalazione-api';
import { Segnalazione, StatoSegnalazione } from '../models/segnalazione.model';
import { NOME_ICONA_FALLBACK, svgIcona } from '../shared/icone-categoria';
import { Tema, TemaService } from '../shared/tema';
import { DialoghiService } from '../shared/dialoghi/dialoghi';
import { ToastService } from '../shared/toast/toast';
import { GRAVITA, Gravita } from '../models/gravita.model';
import { chiaveGravita, classeGravita, classePallinoGravita } from '../shared/gravita';
import { formattaData, formattaDistanza } from './formattazione';
import { ListaSegnalazioni } from './lista-segnalazioni';
import { NavbarMappa, VistaMappa } from './navbar-mappa';
import { NuovaSegnalazione } from './nuova-segnalazione';
import { SceltaPosizione } from './scelta-posizione';
import { Soccorsi } from './soccorsi';

// Le icone di default di Leaflet puntano a percorsi relativi al CSS che il
// bundler di Angular non risolve: le ripuntiamo verso gli asset statici
// copiati in public/assets/leaflet (vedi angular.json -> assets, e il
// "Marker Setup" del cookbook di ngx-leaflet).
import { Icon } from 'leaflet';
Icon.Default.mergeOptions({
  iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
  iconUrl: 'assets/leaflet/marker-icon.png',
  shadowUrl: 'assets/leaflet/marker-shadow.png',
});

// MapLibre ricava l'URL del suo web worker da import.meta.url, che il bundler di Angular
// non preserva: il worker (e il modulo condiviso che importa) vengono copiati da
// node_modules in assets/maplibre (vedi angular.json -> assets) e indicati qui.
setWorkerUrl('assets/maplibre/maplibre-gl-worker.mjs');

/** Zoom "la mia posizione" delle app di navigazione: qualche isolato attorno all'utente. */
const ZOOM_POSIZIONE_UTENTE = 17;

const COLORE_POSIZIONE = '#2563eb';

/** Oltre questo raggio (zoom molto basso) non ha senso chiedere tutte le segnalazioni. */
const RAGGIO_MASSIMO_METRI = 20_000;

/**
 * Alone sfumato attorno a ogni segnalazione: l'evento è stato segnalato lì, ma nel frattempo
 * può essersi spostato nei dintorni. In metri, così scala con lo zoom come la mappa.
 */
const RAGGIO_INCERTEZZA_METRI = 100;

const SOGLIA_TRASCINAMENTO_PX = 40;

/** Trascinando il pin: distanza dal bordo visibile a cui la mappa inizia a scorrere, e velocità. */
const MARGINE_AUTOSCORRIMENTO_PX = 50;
const VELOCITA_AUTOSCORRIMENTO_PX = 10;
/** Altezza della goccia del pin sopra la sua punta (vedi iconAnchor del pin). */
const ALTEZZA_PIN_PX = 48;

/** Parti interne del trascinamento dei marker di Leaflet 1.9 usate da spostaMappaTenendoPin. */
interface TrascinamentoMarkerInterno {
  _draggable: { _newPos: Point; _startPos: Point };
  _onDrag(evento: object): void;
}

/**
 * Sposta la mappa di `movimento` px lasciando il pin sotto il dito: è ciò che fa l'autoPan
 * nativo di Leaflet (MarkerDrag._adjustPan), replicato perché il suo padding è simmetrico.
 * Usa API interne di Leaflet 1.9: da ricontrollare se si aggiorna Leaflet.
 */
function spostaMappaTenendoPin(map: LeafletMap, pin: Marker, movimento: Point): void {
  const trascinamento = pin.dragging as unknown as TrascinamentoMarkerInterno | undefined;
  const icona = pin.getElement();
  if (!trascinamento?._draggable || !icona) {
    return;
  }
  map.panBy(movimento, { animate: false });
  trascinamento._draggable._newPos = trascinamento._draggable._newPos.add(movimento);
  trascinamento._draggable._startPos = trascinamento._draggable._startPos.add(movimento);
  DomUtil.setPosition(icona, trascinamento._draggable._newPos);
  trascinamento._onDrag({});
}

/** Una segnalazione grave "pulsa" sulla mappa per la sua prima ora. */
const DURATA_IMPULSO_MS = 60 * 60_000;

/**
 * Tutti i marker sono badge quadrati con la punta sotto; la gravità bassa è un po' più piccola e
 * discreta (vedi .marker-segnalazione--g1), media e alta hanno la misura piena.
 */
function iconaMarker(icona: string, attiva: boolean, gravita: Gravita, recente: boolean) {
  const classiSpillo = `spillo spillo--g${gravita}${attiva ? ' spillo--attiva' : ''}${recente ? ' spillo--recente' : ''}`;
  const classiBadge = `marker-segnalazione marker-segnalazione--g${gravita}${attiva ? ' marker-segnalazione--attiva' : ''}`;
  return divIcon({
    className: '',
    html: `<span class="${classiSpillo}"><span class="spillo-punta"></span><span class="${classiBadge}">${svgIcona(icona)}</span></span>`,
    // Spillo: badge da 36px più la punta sotto; l'ancora è la punta, sul punto esatto. Così il
    // pallino della posizione (che sta sopra) non copre l'icona se i due coincidono.
    iconSize: [36, 46],
    iconAnchor: [18, 46],
  });
}

/**
 * Alone sfumato con un gradiente radiale (definito una volta in mappa.html) invece di un
 * filter: blur() su ogni cerchio, che il browser ricalcola a ogni pan e zoom.
 */
function stileAlone(attiva: boolean, gravita: Gravita) {
  // Selezionata: alone nel colore della gravità, come il marker; le altre restano grigie.
  return { fillColor: attiva ? `url(#alone-attivo-${gravita})` : 'url(#alone)', fillOpacity: 1 };
}

/** Il filtro per gravità si ricorda tra una visita e l'altra (solo comodità: se manca, "Tutte"). */
const CHIAVE_FILTRO_GRAVITA = 'crime-mappa-gravita';

function leggiFiltroGravitaSalvato(): Gravita | null {
  try {
    const salvato = Number(localStorage.getItem(CHIAVE_FILTRO_GRAVITA));
    return (GRAVITA as readonly number[]).includes(salvato) ? (salvato as Gravita) : null;
  } catch {
    return null;
  }
}

/** Aprendo una segnalazione da uno zoom più lontano di così, ci si avvicina prima di centrarla. */
const ZOOM_MINIMO_CENTRATURA = 15;

/**
 * Sotto questo zoom i marker vicini si raggruppano in cluster con il numero; da qui in su si
 * vedono sempre singoli. È anche lo zoom minimo a cui si apre un dettaglio
 * (ZOOM_MINIMO_CENTRATURA), quindi la segnalazione aperta non è mai nascosta in un cluster.
 */
const ZOOM_SENZA_CLUSTER = 15;

/**
 * Gli aloni (100 m) compaiono con i marker singoli: sotto questo zoom sarebbero larghi pochi
 * pixel e attorno a un cluster non avrebbero senso. Il livello si toglie dalla mappa, così pan e
 * zoom da lontano non ridisegnano centinaia di cerchi SVG.
 */
const ZOOM_MINIMO_ALONI = ZOOM_SENZA_CLUSTER;

/** Opzioni dei marker delle segnalazioni: la gravità serve al colore del cluster che li contiene. */
interface OpzioniMarkerSegnalazione extends MarkerOptions {
  gravita: Gravita;
}

/**
 * Gruppo che raggruppa i marker vicini. Cluster misto: cerchio scuro neutro con il totale e un
 * badge rosso con il numero delle gravi, se ce ne sono (colorarlo tutto di rosso per una sola
 * grave renderebbe rossa quasi ogni zona). Cluster di una sola gravità (es. col filtro): il
 * colore di quella gravità, senza badge. La funzione arriva dal plugin sull'oggetto globale L,
 * non dall'import di 'leaflet'.
 */
function creaGruppoCluster(
  etichetta: (numero: number, gravi: number) => string,
): MarkerClusterGroup {
  const opzioni: MarkerClusterGroupOptions = {
    disableClusteringAtZoom: ZOOM_SENZA_CLUSTER,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: false,
    chunkedLoading: true,
    maxClusterRadius: 50,
    iconCreateFunction: (cluster: MarkerCluster) => {
      const numero = cluster.getChildCount();
      const gravita = cluster
        .getAllChildMarkers()
        .map((figlio) => (figlio.options as OpzioniMarkerSegnalazione).gravita ?? 1);
      const gravi = gravita.filter((g) => g === 3).length;
      const unica = gravita.every((g) => g === gravita[0]) ? gravita[0] : null;
      const lato = numero < 10 ? 36 : numero < 100 ? 42 : 48;
      const testo = etichetta(numero, gravi);
      const classe =
        unica === null ? 'cluster-segnalazioni--misto' : `cluster-segnalazioni--g${unica}`;
      const badge =
        unica === null && gravi > 0
          ? `<span class="cluster-segnalazioni-gravi" aria-hidden="true">${gravi}</span>`
          : '';
      return divIcon({
        className: '',
        html: `<span class="cluster-segnalazioni ${classe}" style="width:${lato}px;height:${lato}px" role="img" aria-label="${testo}" title="${testo}">${numero}${badge}</span>`,
        iconSize: [lato, lato],
        iconAnchor: [lato / 2, lato / 2],
      });
    },
  };
  const L = (
    window as unknown as { L: { markerClusterGroup: typeof import('leaflet').markerClusterGroup } }
  ).L;
  return L.markerClusterGroup(opzioni);
}

type PannelloMappa = 'nuova-posizione' | 'nuova-dettagli' | 'soccorsi' | null;

interface AreaVisibile {
  centro: LatLng;
  raggioMetri: number;
}

/** Si carica un'area più ampia della vista, così i piccoli spostamenti restano coperti. */
const MARGINE_AREA_CARICATA = 1.5;
/** Oltre questo tempo l'area caricata si considera vecchia (nuove segnalazioni di altri). */
const VALIDITA_AREA_MS = 60_000;

/**
 * Stili vettoriali OpenFreeMap (open source, gratuiti, senza chiave), resi da MapLibre GL
 * dentro un layer Leaflet: pallino e overlay restano layer Leaflet normali sopra la mappa.
 */
/** Stile vettoriale per tema: al cambio tema setStyle ricarica lo stile (vedi constructor). */
const STILI_PER_TEMA: Record<Tema, string> = { chiaro: 'positron', scuro: 'fiord' };

function urlStileOpenFreeMap(stile: string): string {
  return `https://tiles.openfreemap.org/styles/${stile}`;
}

function sfondoOpenFreeMap(stile: string): MaplibreGL {
  // L'attribuzione (OpenFreeMap, OpenMapTiles, OSM) arriva dalle sorgenti dello stile: il
  // plugin la inserisce nel controllo di Leaflet al "load" di MapLibre.
  return maplibreGL({ style: urlStileOpenFreeMap(stile) });
}

/**
 * Lo stile Bright chiede icone (es. "gate", "bollard", "office") assenti dallo sprite di
 * OpenFreeMap, e MapLibre logga un warning per ognuna. Registrarle come immagine vuota non
 * cambia nulla a video (l'icona non esiste comunque) ma evita il rumore in console.
 * Il resolver resta valido anche dopo setStyle: basta impostarlo una volta.
 */
function ignoraIconeMancanti(sfondo: MaplibreGL): void {
  const glMap = sfondo.getMaplibreMap();
  glMap.setMissingStyleImageResolver((id) => {
    if (!glMap.hasImage(id)) {
      glMap.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
    }
  });
}

/**
 * Luoghi utili in caso di emergenza, dal livello `poi` delle tile OpenMapTiles (classi con
 * icona nello sprite OpenFreeMap). In ordine di priorità: se si sovrappongono vince il primo.
 */
const CLASSI_LUOGHI_UTILI = [
  'hospital',
  'police',
  'fire_station',
  'doctors',
  'railway',
  'town_hall',
];
const ID_LIVELLO_LUOGHI_UTILI = 'luoghi-utili';

/**
 * Zone sensibili (scuole, parchi, parchi giochi): più numerose e meno urgenti dei luoghi di
 * emergenza, quindi compaiono solo da vicino, più discrete, e cedono il posto nelle collisioni.
 * Zoom in unità MapLibre (= zoom della mappa - 1, vedi il livello dei luoghi utili).
 */
const ZONE_SENSIBILI = [
  // Scuole: da zoom mappa 16.
  { id: 'zone-sensibili-scuole', classi: ['school', 'college'], minzoom: 15 },
  // Parchi e parchi giochi, i più numerosi: da zoom mappa 17.
  { id: 'zone-sensibili-svago', classi: ['playground', 'park'], minzoom: 16 },
];
/** Il nome delle zone sensibili compare solo da zoom mappa 17; prima solo l'icona. */
const ZOOM_NOMI_ZONE_SENSIBILI = 16;

const NOME_LUOGO: ExpressionSpecification = ['coalesce', ['get', 'name:latin'], ['get', 'name']];

/** Alone scuro delle etichette sullo stile scuro: stacca il testo da strade e aree (sfondo #45516E). */
const ALONE_ETICHETTE_SCURO = 'rgba(22, 28, 44, 0.85)';

/** Colori di testo e alone dei nostri livelli di luoghi, per tema. */
const PALETTE_LUOGHI = {
  chiaro: { luoghi: '#555', zone: '#888', alone: '#ffffff' },
  scuro: { luoghi: '#dbe3ee', zone: '#aeb9c9', alone: ALONE_ETICHETTE_SCURO },
} as const;

/**
 * Fiord (stile scuro) ha etichette quasi dello stesso tono dello sfondo: nomi dei quartieri a
 * contrasto ~1,6:1, vie e acque poco sopra. Si schiariscono testo e alone di tutte le etichette
 * dello stile (non font, dimensioni o posizioni): luoghi abitati più chiari (~7:1), il resto ~5:1.
 */
function schiarisciEtichette(glMap: ReturnType<MaplibreGL['getMaplibreMap']>): void {
  for (const livello of glMap.getStyle().layers) {
    if (livello.type !== 'symbol' || !livello.layout?.['text-field']) {
      continue;
    }
    if (livello.id === ID_LIVELLO_LUOGHI_UTILI || ZONE_SENSIBILI.some((z) => z.id === livello.id)) {
      continue;
    }
    const abitato = livello.id.startsWith('place_');
    glMap.setPaintProperty(livello.id, 'text-color', abitato ? '#e8eef6' : '#c5cfdd');
    glMap.setPaintProperty(livello.id, 'text-halo-color', ALONE_ETICHETTE_SCURO);
    glMap.setPaintProperty(livello.id, 'text-halo-width', 1.5);
    glMap.setPaintProperty(livello.id, 'text-halo-blur', 0.5);
  }
}

/**
 * Positron (come gli altri stili minimali) non disegna i luoghi di interesse: si aggiunge un
 * livello con solo quelli utili per un'app di sicurezza. Gli stili ricchi (bright, liberty) li
 * hanno già. Va riaggiunto a ogni caricamento di stile: setStyle azzera i livelli aggiunti.
 * Sullo stile scuro, allo stesso momento, si schiariscono le etichette (vedi schiarisciEtichette).
 */
function aggiungiLuoghiUtili(sfondo: MaplibreGL, scuro: () => boolean): void {
  const glMap = sfondo.getMaplibreMap();
  const aggiungi = () => {
    if (scuro()) {
      schiarisciEtichette(glMap);
    }
    const palette = PALETTE_LUOGHI[scuro() ? 'scuro' : 'chiaro'];
    const haGiaLuoghi = glMap
      .getStyle()
      .layers.some((livello) => 'source-layer' in livello && livello['source-layer'] === 'poi');
    if (haGiaLuoghi || glMap.getLayer(ID_LIVELLO_LUOGHI_UTILI)) {
      return;
    }
    glMap.addLayer({
      id: ID_LIVELLO_LUOGHI_UTILI,
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'poi',
      // Zoom MapLibre: il plugin lo tiene uno sotto quello di Leaflet (tile da 512 px), quindi
      // 13 qui = zoom 14 della mappa.
      minzoom: 13,
      filter: ['match', ['get', 'class'], CLASSI_LUOGHI_UTILI, true, false],
      layout: {
        'icon-image': ['get', 'class'],
        'icon-size': 0.9,
        'text-field': NOME_LUOGO,
        'text-font': ['Noto Sans Italic'],
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 0.8],
        'text-max-width': 9,
        // Se non c'è spazio si perde prima il nome, poi l'icona.
        'text-optional': true,
        'symbol-sort-key': ['index-of', ['get', 'class'], ['literal', CLASSI_LUOGHI_UTILI]],
      },
      paint: {
        'text-color': palette.luoghi,
        'text-halo-color': palette.alone,
        'text-halo-width': 1,
        'text-halo-blur': 0.5,
      },
    });
    // Aggiunte sotto i luoghi utili: MapLibre piazza prima i simboli dei livelli più in alto,
    // quindi in caso di sovrapposizione restano ospedali, polizia, ecc.
    for (const zona of ZONE_SENSIBILI) {
      glMap.addLayer(
        {
          id: zona.id,
          type: 'symbol',
          source: 'openmaptiles',
          'source-layer': 'poi',
          minzoom: zona.minzoom,
          filter: ['match', ['get', 'class'], zona.classi, true, false],
          layout: {
            'icon-image': ['get', 'class'],
            'icon-size': 0.8,
            'text-field': ['step', ['zoom'], '', ZOOM_NOMI_ZONE_SENSIBILI, NOME_LUOGO],
            'text-font': ['Noto Sans Italic'],
            'text-size': 10,
            'text-anchor': 'top',
            'text-offset': [0, 0.8],
            'text-max-width': 8,
            'text-optional': true,
          },
          paint: {
            'text-color': palette.zone,
            'text-halo-color': palette.alone,
            'text-halo-width': 1,
            'icon-opacity': 0.85,
          },
        },
        ID_LIVELLO_LUOGHI_UTILI,
      );
    }
  };
  glMap.on('style.load', aggiungi);
  if (glMap.isStyleLoaded()) {
    aggiungi();
  }
}

@Component({
  selector: 'app-mappa',
  standalone: true,
  imports: [
    LeafletDirective,
    TranslocoDirective,
    LucideDynamicIcon,
    NgClass,
    NavbarMappa,
    Soccorsi,
    NuovaSegnalazione,
    SceltaPosizione,
    ListaSegnalazioni,
    NomeCategoriaPipe,
  ],
  templateUrl: './mappa.html',
  host: { '(document:keydown.escape)': 'gestisciEscape()' },
})
export class Mappa {
  /** Chiave i18n dell'avviso da mostrare se la posizione non è disponibile. */
  protected readonly avvisoPosizione = signal<string | null>(null);

  /** Ultima posizione nota dell'utente: abilita il pulsante "torna alla mia posizione". */
  protected readonly posizioneUtente = signal<LatLng | null>(null);

  /** Segnalazioni ATTIVA nell'area visibile, ricaricate quando l'utente sposta la mappa. */
  protected readonly segnalazioni = signal<Segnalazione[]>([]);
  protected readonly selezionata = signal<Segnalazione | null>(null);

  /** Gravità mostrata sulla mappa e nella lista; null = tutte. Filtra i dati già caricati. */
  protected readonly gravitaFiltro = signal<Gravita | null>(leggiFiltroGravitaSalvato());
  protected readonly livelliGravita = GRAVITA;
  protected readonly segnalazioniVisibili = computed(() => {
    const gravita = this.gravitaFiltro();
    const segnalazioni = this.segnalazioni();
    return gravita === null
      ? segnalazioni
      : segnalazioni.filter((s) => s.categoriaGravita === gravita);
  });
  protected readonly erroreSegnalazioni = signal(false);

  /** Stato della risposta a "è ancora in atto?" per la segnalazione aperta. */
  protected readonly invioConferma = signal(false);
  /** Errore del voto, mostrato nel pannello (che resta aperto per riprovare). */
  protected readonly esitoConferma = signal<'errore' | null>(null);

  /** Solo mobile: il pannello di dettaglio si apre compatto e si espande su richiesta. */
  protected readonly pannelloEspanso = signal(false);
  /** Spostamento verso il basso (px) mentre l'utente trascina la maniglia del pannello. */
  protected readonly spostamentoPannello = signal(0);
  private inizioTrascinamentoY: number | null = null;
  private trascinamentoAppenaFinito = false;

  /** Distanza dal pallino alla segnalazione aperta, se la posizione dell'utente è nota. */
  protected readonly distanzaSelezionata = computed(() => {
    const segnalazione = this.selezionata();
    const posizione = this.posizioneUtente();
    if (!segnalazione || !posizione) {
      return null;
    }
    return formattaDistanza(
      posizione.distanceTo([segnalazione.lat, segnalazione.lng]),
      this.transloco.getActiveLang(),
    );
  });

  /** Vista attiva, scelta dalla navbar in basso. */
  protected readonly vista = signal<VistaMappa>('mappa');
  /** Pannello aperto dalla navbar (il dettaglio segnalazione è governato da `selezionata`). */
  protected readonly pannello = signal<PannelloMappa>(null);
  /** Nuova segnalazione in corso, in uno dei due passi (scelta del punto o dettagli). */
  protected readonly nuovaAperta = computed(() => this.pannello()?.startsWith('nuova') ?? false);

  private readonly categorieStore = inject(CategorieStore);
  protected readonly categorie = this.categorieStore.categorie;
  protected readonly categorieAttive = computed(() => this.categorie().filter((c) => c.attiva));

  /** Punto della nuova segnalazione: parte dalla posizione dell'utente, si sposta col pin. */
  protected readonly posizioneNuova = signal<LatLng | null>(null);
  /** Id dell'ultima segnalazione pubblicata, per confermarlo nel suo pannello di dettaglio. */
  protected readonly idAppenaPubblicata = signal<number | null>(null);

  /** Pulsante "torna a me" e avvisi lasciano spazio ai pannelli dal basso. */
  protected readonly pannelloInBassoAperto = computed(
    () => this.selezionata() !== null || this.nuovaAperta(),
  );

  /**
   * Centro della lista: sempre la posizione dell'utente, qualunque sia la zona della mappa.
   * Senza posizione si ripiega sul centro della mappa al momento in cui si apre la lista.
   */
  protected readonly centroLista = computed(
    () => this.posizioneUtente() ?? this.centroAperturaLista(),
  );
  private readonly centroAperturaLista = signal(latLng(45.3181, 8.8589));
  private pinNuova: Marker | null = null;
  private fotogrammaAutoScorrimento: number | null = null;

  private readonly tema = inject(TemaService);
  private readonly transloco = inject(TranslocoService);
  private readonly segnalazioneApi = inject(SegnalazioneApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly rotta = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly dialoghi = inject(DialoghiService);
  /**
   * Al primo fix GPS la mappa si centra sull'utente, tranne quando è stata aperta su una
   * segnalazione precisa (?segnalazione=<id>, es. dal profilo): lì deve restare su quella.
   */
  private centraSuPrimaPosizione = true;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly formNuova = viewChild(NuovaSegnalazione);

  /** Id (e non oggetto) così l'esito del voto non si azzera quando la segnalazione aperta si aggiorna. */
  private readonly idSelezionata = computed(() => this.selezionata()?.id ?? null);

  /** categoriaId -> nome icona Lucide, per disegnare il marker con l'icona della categoria. */
  protected readonly iconePerCategoria = computed(
    () => new Map(this.categorie().map((c) => [c.id, c.icona ?? NOME_ICONA_FALLBACK])),
  );
  private readonly areaRichiesta = new Subject<AreaVisibile>();
  private areaCaricata: (AreaVisibile & { istante: number }) | null = null;
  /** Marker delle segnalazioni, raggruppati in cluster sotto ZOOM_SENZA_CLUSTER. */
  private readonly livelloSegnalazioni = creaGruppoCluster((numero, gravi) =>
    this.transloco.translate(gravi > 0 ? 'mappa.clusterConGravi' : 'mappa.cluster', {
      numero,
      gravi,
    }),
  );
  /** Istante corrente, aggiornato ogni minuto: fa scadere l'impulso delle segnalazioni gravi. */
  private readonly orologio = signal(Date.now());
  private readonly timerOrologio = setInterval(() => this.orologio.set(Date.now()), 60_000);
  /** Aloni separati dai marker: il gruppo sta sulla mappa solo da ZOOM_MINIMO_ALONI in su. */
  private readonly livelloAloni = layerGroup();
  /** Marker e alone per id di segnalazione, con una "firma" per capire se vanno ritoccati. */
  private readonly marcatori = new Map<number, { marker: Marker; alone: Circle; firma: string }>();

  /** Signal (e non campo semplice) così l'effect del tema riparte quando la mappa è pronta. */
  private readonly mappa = signal<LeafletMap | null>(null);
  private idWatch: number | null = null;
  private pallino: Marker | null = null;
  private cerchioPrecisione: Circle | null = null;

  /**
   * Un solo sfondo vettoriale: al cambio tema si cambia lo stile sulla stessa mappa MapLibre
   * (setStyle), che riusa contesto WebGL e cache. Se lo stile non cambia non si fa nulla.
   */
  private readonly sfondo = sfondoOpenFreeMap(STILI_PER_TEMA[this.tema.temaMappa()]);
  private stileSfondo = STILI_PER_TEMA[this.tema.temaMappa()];
  private resolverIconeImpostato = false;

  /** Centro di default (Lombardia): resta tale se l'utente non condivide la posizione. */
  protected readonly options: MapOptions = {
    layers: [this.sfondo],
    zoom: 13,
    // Obbligatorio per il raggruppamento dei marker (lo sfondo MapLibre non ne dichiara uno):
    // 19 è il dettaglio dei singoli edifici, come nelle mappe stradali.
    maxZoom: 19,
    center: latLng(45.3181, 8.8589),
  };

  constructor() {
    effect(() => {
      const map = this.mappa();
      const tema = this.tema.temaMappa();
      if (!map) {
        return;
      }
      if (!this.resolverIconeImpostato) {
        ignoraIconeMancanti(this.sfondo);
        aggiungiLuoghiUtili(this.sfondo, () => this.stileSfondo === STILI_PER_TEMA.scuro);
        this.resolverIconeImpostato = true;
      }
      const stile = STILI_PER_TEMA[tema];
      if (stile !== this.stileSfondo) {
        this.stileSfondo = stile;
        this.sfondo.getMaplibreMap().setStyle(urlStileOpenFreeMap(stile));
      }
    });

    // Aprendo un'altra segnalazione, l'esito del voto precedente non la riguarda più.
    effect(() => {
      this.idSelezionata();
      this.esitoConferma.set(null);
    });

    // Aggiorna i marker in modo incrementale: si creano solo i nuovi, si rimuovono quelli spariti
    // e si ritoccano solo quelli cambiati (posizione, icona, selezione), invece di ridisegnare tutto.
    effect(() => {
      const icone = this.iconePerCategoria();
      const selezionataId = this.selezionata()?.id;
      const presenti = new Set<number>();
      // Letto qui così l'effect riparte ogni minuto e l'impulso delle gravi si spegne da solo.
      const adesso = this.orologio();
      for (const segnalazione of this.segnalazioniVisibili()) {
        presenti.add(segnalazione.id);
        const attiva = segnalazione.id === selezionataId;
        const icona = icone.get(segnalazione.categoriaId) ?? NOME_ICONA_FALLBACK;
        const gravita = segnalazione.categoriaGravita;
        const recente =
          gravita === 3 && adesso - Date.parse(segnalazione.dataCreazione) < DURATA_IMPULSO_MS;
        const posizione = latLng(segnalazione.lat, segnalazione.lng);
        // Nel nome c'è la lingua: al cambio lingua il marker va ritoccato anche se non si è mosso.
        const nome = this.categorieStore.nome(segnalazione);
        const firma = `${segnalazione.lat},${segnalazione.lng},${icona},${gravita},${attiva},${recente},${nome}`;
        const esistente = this.marcatori.get(segnalazione.id);
        if (esistente?.firma === firma) {
          continue;
        }
        if (esistente) {
          esistente.alone.setLatLng(posizione).setStyle(stileAlone(attiva, gravita));
          // Il gruppo dei cluster non segue posizione e gravità di un marker già dentro: lo si
          // toglie, si aggiorna e lo si rimette, così cluster e conteggi restano giusti.
          this.livelloSegnalazioni.removeLayer(esistente.marker);
          // setIcon ricrea l'elemento del marker leggendo title/alt dalle options.
          const opzioni = esistente.marker.options as OpzioniMarkerSegnalazione;
          opzioni.title = nome;
          opzioni.alt = nome;
          opzioni.gravita = gravita;
          esistente.marker
            .setLatLng(posizione)
            .setIcon(iconaMarker(icona, attiva, gravita, recente))
            .setZIndexOffset(attiva ? 1000 : 0);
          this.livelloSegnalazioni.addLayer(esistente.marker);
          esistente.firma = firma;
          continue;
        }
        const id = segnalazione.id;
        const alone = circle(posizione, {
          radius: RAGGIO_INCERTEZZA_METRI,
          stroke: false,
          interactive: false,
          ...stileAlone(attiva, gravita),
        }).addTo(this.livelloAloni);
        const opzioni: OpzioniMarkerSegnalazione = {
          icon: iconaMarker(icona, attiva, gravita, recente),
          title: nome,
          alt: nome,
          keyboard: true,
          riseOnHover: true,
          zIndexOffset: attiva ? 1000 : 0,
          gravita,
        };
        const nuovo = marker(posizione, opzioni)
          // Si apre la versione attuale della segnalazione, non quella di quando è nato il marker.
          .on('click', () => {
            const attuale = this.segnalazioni().find((s) => s.id === id);
            if (attuale) {
              this.apriDettaglio(attuale);
            }
          })
          .addTo(this.livelloSegnalazioni);
        this.marcatori.set(id, { marker: nuovo, alone, firma });
      }
      for (const [id, { marker: vecchio, alone }] of this.marcatori) {
        if (!presenti.has(id)) {
          // Dal gruppo, non solo dalla mappa: un gruppo riaggiunto rimetterebbe i layer rimasti.
          this.livelloSegnalazioni.removeLayer(vecchio);
          this.livelloAloni.removeLayer(alone);
          this.marcatori.delete(id);
        }
      }
    });

    // Pin della nuova segnalazione: al passo 1 si prende e si trascina sul punto (segue il dito),
    // al passo 2 resta fermo sul punto scelto.
    effect(() => {
      const map = this.mappa();
      const posizione = this.posizioneNuova();
      const passo = this.pannello();
      if (!map || !this.nuovaAperta() || !posizione) {
        this.pinNuova?.remove();
        this.pinNuova = null;
        return;
      }
      if (!this.pinNuova) {
        this.pinNuova = marker(posizione, {
          draggable: true,
          // Auto-scorrimento gestito da autoScorrimentoPin, sui bordi della zona visibile.
          autoPan: false,
          zIndexOffset: 2000,
          title: this.transloco.translate('mappa.nuova.pin'),
          alt: this.transloco.translate('mappa.nuova.pin'),
          icon: divIcon({
            className: '',
            html: `<span class="pin-trascinabile"><span class="pin-nuova-segnalazione">${svgIcona('plus')}</span></span>`,
            iconSize: [40, 48],
            // La punta della goccia (angolo ruotato di 45°) è il fondo dell'icona.
            iconAnchor: [20, 48],
          }),
        })
          .on('dragstart', () => {
            this.pinNuova?.getElement()?.classList.add('pin-in-trascinamento');
            this.autoScorrimentoPin(map, this.pinNuova!);
          })
          .on('dragend', () => {
            this.fermaAutoScorrimento();
            this.pinNuova?.getElement()?.classList.remove('pin-in-trascinamento');
            this.posizioneNuova.set(this.pinNuova!.getLatLng());
          })
          .addTo(map);
      } else if (!this.pinNuova.getLatLng().equals(posizione)) {
        this.pinNuova.setLatLng(posizione);
      }
      if (passo === 'nuova-posizione') {
        this.pinNuova.dragging?.enable();
      } else {
        this.pinNuova.dragging?.disable();
      }
    });

    // debounce: un trascinamento produce molti moveend; switchMap scarta le risposte superate.
    this.areaRichiesta
      .pipe(
        debounceTime(300),
        switchMap((area) =>
          this.segnalazioneApi.vicine(area.centro.lat, area.centro.lng, area.raggioMetri).pipe(
            tap(() => {
              this.erroreSegnalazioni.set(false);
              // Solo a caricamento riuscito l'area conta come coperta.
              this.areaCaricata = { ...area, istante: Date.now() };
            }),
            catchError(() => {
              this.erroreSegnalazioni.set(true);
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((segnalazioni) => {
        if (segnalazioni) {
          this.segnalazioni.set(segnalazioni);
        }
      });

    // Senza categorie i marker usano l'icona di fallback e il nome italiano della segnalazione.
    this.categorieStore.carica();

    inject(DestroyRef).onDestroy(() => {
      clearInterval(this.timerOrologio);
      this.fermaAutoScorrimento();
      if (this.idWatch !== null) {
        navigator.geolocation.clearWatch(this.idWatch);
      }
    });
  }

  /**
   * Quando la mappa arriva dopo una navigazione (come in questo caso, aperta
   * al click da un'altra pagina), Leaflet può calcolare la griglia dei tile
   * prima che il contenitore abbia le dimensioni finali, lasciando "buchi".
   * invalidateSize() forza Leaflet a ricalcolare e completare il caricamento.
   */
  protected onMapReady(map: LeafletMap): void {
    setTimeout(() => map.invalidateSize(), 0);
    setTimeout(() => map.invalidateSize(), 250);
    this.mappa.set(map);
    this.livelloSegnalazioni.addTo(map);
    this.mostraAloniSeVicino(map);
    map.on('zoomend', () => this.mostraAloniSeVicino(map));
    map.on('moveend', () => {
      this.richiediSegnalazioni(map);
    });
    // Un tocco sulla mappa chiude il pannello aperto, come per il dettaglio. Il form può avere
    // dati non inviati: decide lui se chiudere subito o chiedere conferma.
    this.attribuzioneCompatta(map);
    map.on('click', () => {
      this.impostaAttribuzioneAperta(map, false);
      if (this.nuovaAperta()) {
        this.chiudiNuovaSegnalazione();
      } else {
        this.selezionata.set(null);
      }
    });
    this.richiediSegnalazioni(map);
    this.apriSegnalazioneRichiesta();
    this.seguiPosizioneUtente(map);
  }

  private mostraAloniSeVicino(map: LeafletMap): void {
    const vicino = map.getZoom() >= ZOOM_MINIMO_ALONI;
    if (vicino && !map.hasLayer(this.livelloAloni)) {
      this.livelloAloni.addTo(map);
    } else if (!vicino && map.hasLayer(this.livelloAloni)) {
      this.livelloAloni.remove();
    }
  }

  /**
   * Crediti della mappa compatti, come Google Maps e MapLibre: al posto del prefisso
   * "🇺🇦 Leaflet" (non richiesto dalla licenza) un pulsante "i" che mostra o nasconde i crediti
   * di OpenFreeMap / OpenMapTiles / OpenStreetMap, che invece vanno sempre resi accessibili.
   * Lo stato aperto/chiuso è solo una classe sul contenitore: l'HTML del controllo non va
   * rigenerato durante il click, o Leaflet non riconoscerebbe più il pulsante (staccato dal DOM)
   * come parte del controllo e tratterebbe il click come un tocco sulla mappa, che lo richiude.
   */
  private attribuzioneCompatta(map: LeafletMap): void {
    const controllo = map.attributionControl;
    const contenitore = controllo?.getContainer();
    if (!controllo || !contenitore) {
      return;
    }
    const etichetta = this.transloco.translate('mappa.crediti');
    controllo.setPrefix(
      `<button type="button" class="attribuzione-info" aria-label="${etichetta}" title="${etichetta}" aria-expanded="false">i</button>`,
    );
    contenitore.addEventListener('click', (evento) => {
      if ((evento.target as HTMLElement).closest('.attribuzione-info')) {
        const aperta = !contenitore.classList.contains('attribuzione-aperta');
        this.impostaAttribuzioneAperta(map, aperta);
      }
    });
    // Leaflet ricrea l'HTML quando cambiano i crediti (es. nuovo stile al cambio tema):
    // il nuovo pulsante riprende lo stato dal contenitore.
    new MutationObserver(() => this.impostaAttribuzioneAperta(map, null)).observe(contenitore, {
      childList: true,
    });
  }

  /** `null` riallinea solo `aria-expanded` allo stato attuale. */
  private impostaAttribuzioneAperta(map: LeafletMap, aperta: boolean | null): void {
    const contenitore = map.attributionControl?.getContainer();
    if (!contenitore) {
      return;
    }
    if (aperta !== null) {
      contenitore.classList.toggle('attribuzione-aperta', aperta);
    }
    const pulsante = contenitore.querySelector('.attribuzione-info');
    const stato = String(contenitore.classList.contains('attribuzione-aperta'));
    if (pulsante && pulsante.getAttribute('aria-expanded') !== stato) {
      pulsante.setAttribute('aria-expanded', stato);
    }
  }

  protected chiudiAvviso(): void {
    this.avvisoPosizione.set(null);
  }

  protected chiudiDettaglio(): void {
    this.selezionata.set(null);
  }

  /** Apre il dettaglio e porta la segnalazione al centro della mappa rimasta visibile. */
  private apriDettaglio(segnalazione: Segnalazione): void {
    // Con il form aperto un tocco su un marker vale come un tocco sulla mappa: chiede di chiudere.
    if (this.nuovaAperta()) {
      this.chiudiNuovaSegnalazione();
      return;
    }
    this.selezionata.set(segnalazione);
    this.pannelloEspanso.set(false);
    this.centraNellaZonaLibera(latLng(segnalazione.lat, segnalazione.lng));
  }

  /**
   * Centra `posizione` nella parte di mappa non coperta, sopra il pannello e la navbar. Le misure si leggono dopo il render,
   * quando il pannello appena aperto esiste; offsetTop/offsetLeft ignorano l'animazione
   * d'ingresso (transform), che falserebbe getBoundingClientRect.
   */
  private centraNellaZonaLibera(posizione: LatLng, zoomMinimo = ZOOM_MINIMO_CENTRATURA): void {
    const map = this.mappa();
    if (!map) {
      return;
    }
    if (map.getZoom() < zoomMinimo) {
      map.setView(posizione, zoomMinimo, { animate: false });
    }
    afterNextRender(
      () => {
        const centro = this.centroZonaLibera(map);
        const punto = map.latLngToContainerPoint(posizione);
        const riduciMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
        map.panBy([punto.x - centro.x, punto.y - centro.y], { animate: !riduciMovimento });
      },
      { injector: this.injector },
    );
  }

  /** Punto (px nel contenitore della mappa) in cui centrare: il centro della parte sopra il pannello. */
  private centroZonaLibera(map: LeafletMap): { x: number; y: number } {
    const { destra, basso } = this.zonaLibera(map);
    return { x: Math.round(destra / 2), y: Math.round(basso / 2) };
  }

  /** Bordi (px nel contenitore) della parte di mappa visibile; sinistra e alto sono 0. */
  private zonaLibera(map: LeafletMap): { destra: number; basso: number } {
    const radice = this.host.nativeElement;
    // Solo il pannello visibile: il form resta montato (nascosto) mentre si sceglie il punto.
    const pannello = [...radice.querySelectorAll<HTMLElement>('.pannello-mappa')].find(
      (elemento) => elemento.offsetParent !== null,
    );
    const navbar = radice.querySelector<HTMLElement>('app-navbar-mappa nav');
    const { x: larghezza, y: altezza } = map.getSize();
    // Il pannello (a tutta larghezza o card centrata) sta sempre in basso: conta solo il bordo alto.
    const bordoBasso = Math.min(
      navbar ? navbar.offsetTop : altezza,
      pannello ? pannello.offsetTop : altezza,
    );
    return { destra: larghezza, basso: bordoBasso };
  }

  /**
   * Auto-scorrimento mentre si trascina il pin: la mappa scorre quando la punta si avvicina
   * al bordo della zona visibile (card/pannello/navbar), non del contenitore Leaflet, che sta
   * anche sotto di loro. L'autoPan nativo dei marker ha un padding simmetrico e non lo
   * permette. Gira a ogni frame finché dura il trascinamento.
   */
  private autoScorrimentoPin(map: LeafletMap, pin: Marker): void {
    const passo = () => {
      const { destra, basso } = this.zonaLibera(map);
      const punta = map.latLngToContainerPoint(pin.getLatLng());
      const m = MARGINE_AUTOSCORRIMENTO_PX;
      // Frazione di "penetrazione" nel margine (0..1) per lato, come fa Leaflet.
      const verso = (valore: number, minimo: number, massimo: number) =>
        Math.min(1, Math.max(0, valore - (massimo - m)) / m) -
        Math.min(1, Math.max(0, minimo + m - valore) / m);
      const movimento = point(
        verso(punta.x, 0, destra),
        // In alto conta il corpo della goccia (ALTEZZA_PIN sopra la punta), non la punta.
        verso(punta.y, ALTEZZA_PIN_PX, basso),
      ).multiplyBy(VELOCITA_AUTOSCORRIMENTO_PX);
      if (movimento.x !== 0 || movimento.y !== 0) {
        spostaMappaTenendoPin(map, pin, movimento);
      }
      this.fotogrammaAutoScorrimento = requestAnimationFrame(passo);
    };
    this.fermaAutoScorrimento();
    this.fotogrammaAutoScorrimento = requestAnimationFrame(passo);
  }

  private fermaAutoScorrimento(): void {
    if (this.fotogrammaAutoScorrimento !== null) {
      cancelAnimationFrame(this.fotogrammaAutoScorrimento);
      this.fotogrammaAutoScorrimento = null;
    }
  }

  // Maniglia del pannello su mobile: tap alterna compatto/espanso; trascinando in su si
  // espande, in giù si compatta e, se già compatto, si chiude.
  protected iniziaTrascinamento(evento: PointerEvent): void {
    this.inizioTrascinamentoY = evento.clientY;
    (evento.currentTarget as HTMLElement).setPointerCapture(evento.pointerId);
  }

  protected trascina(evento: PointerEvent): void {
    if (this.inizioTrascinamentoY === null) {
      return;
    }
    // Solo verso il basso il pannello segue il dito: verso l'alto conta la soglia di rilascio.
    this.spostamentoPannello.set(Math.max(0, evento.clientY - this.inizioTrascinamentoY));
  }

  protected terminaTrascinamento(evento: PointerEvent): void {
    if (this.inizioTrascinamentoY === null) {
      return;
    }
    const delta = evento.clientY - this.inizioTrascinamentoY;
    this.inizioTrascinamentoY = null;
    this.spostamentoPannello.set(0);
    if (Math.abs(delta) < SOGLIA_TRASCINAMENTO_PX) {
      return;
    }
    this.trascinamentoAppenaFinito = true;
    if (delta < 0) {
      this.pannelloEspanso.set(true);
    } else if (this.pannelloEspanso()) {
      this.pannelloEspanso.set(false);
    } else {
      this.chiudiDettaglio();
    }
  }

  protected alternaPannello(): void {
    // Il click che segue un trascinamento non deve annullarne l'effetto.
    if (this.trascinamentoAppenaFinito) {
      this.trascinamentoAppenaFinito = false;
      return;
    }
    this.pannelloEspanso.update((espanso) => !espanso);
  }

  /**
   * Risposta a "è ancora in atto?". Il voto è l'azione conclusiva del dettaglio: a buon fine il
   * pannello si chiude con un toast; in errore resta aperto per riprovare. Il backend restituisce
   * la segnalazione aggiornata: se è ancora ATTIVA ha la nuova scadenza, altrimenti è stata chiusa
   * (dai "no" oltre soglia, o dal "no" dell'autore) e va tolta dalla mappa.
   */
  protected async conferma(ancoraInAtto: boolean): Promise<void> {
    const segnalazione = this.selezionata();
    if (!segnalazione || this.invioConferma() || !this.verificaLogin()) {
      return;
    }
    // Il "no" dell'autore chiude subito la segnalazione per tutti: si chiede conferma.
    const autore =
      segnalazione.autoreId != null && segnalazione.autoreId === this.auth.utente()?.id;
    if (autore && !ancoraInAtto) {
      const confermato = await this.dialoghi.conferma({
        titolo: this.transloco.translate('mappa.dettaglio.conferma.chiudiTitolo'),
        messaggio: this.transloco.translate('mappa.dettaglio.conferma.chiudiMessaggio'),
        conferma: this.transloco.translate('mappa.dettaglio.conferma.chiudiConferma'),
        pericolo: true,
      });
      if (!confermato || this.idSelezionata() !== segnalazione.id) {
        return;
      }
    }
    this.invioConferma.set(true);
    this.esitoConferma.set(null);
    this.segnalazioneApi
      .conferma(segnalazione.id, { ancoraInAtto })
      .pipe(
        finalize(() => this.invioConferma.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (aggiornata) => {
          if (this.idSelezionata() === aggiornata.id) {
            this.selezionata.set(null);
          }
          if (aggiornata.stato === StatoSegnalazione.ATTIVA) {
            this.segnalazioni.update((elenco) =>
              elenco.map((s) => (s.id === aggiornata.id ? aggiornata : s)),
            );
            // "Prolungata" solo se il backend l'ha davvero prolungata: un sì ripetuto o troppo
            // ravvicinato al proprio precedente vale solo come voto.
            const prolungata =
              ancoraInAtto && aggiornata.dataUltimaConferma !== segnalazione.dataUltimaConferma;
            this.toast.successo(
              this.transloco.translate(
                prolungata
                  ? 'mappa.dettaglio.conferma.prolungata'
                  : 'mappa.dettaglio.conferma.registrata',
              ),
            );
            return;
          }
          this.segnalazioni.update((elenco) => elenco.filter((s) => s.id !== aggiornata.id));
          this.toast.successo(
            this.transloco.translate(
              autore ? 'mappa.dettaglio.conferma.chiusaAutore' : 'mappa.dettaglio.conferma.chiusa',
            ),
          );
        },
        error: () => {
          if (this.idSelezionata() === segnalazione.id) {
            this.esitoConferma.set('errore');
          }
        },
      });
  }

  /**
   * La mappa è consultabile senza login, ma pubblicare e votare richiedono un account:
   * senza sessione si va al login, che al termine riporta sulla mappa.
   */
  private verificaLogin(): boolean {
    if (this.auth.autenticato()) {
      return true;
    }
    this.toast.info(this.transloco.translate('auth.richiestoLogin'));
    void this.router.navigate(['/login'], { queryParams: { redirect: '/mappa' } });
    return false;
  }

  protected formattaData(iso: string): string {
    return formattaData(iso, this.transloco.getActiveLang());
  }

  protected cambiaVista(vista: VistaMappa): void {
    this.vista.set(vista);
    if (vista === 'lista') {
      this.selezionata.set(null);
      const map = this.mappa();
      if (map) {
        this.centroAperturaLista.set(map.getCenter());
      }
    }
  }

  protected apriSoccorsi(): void {
    this.pannello.set('soccorsi');
  }

  protected chiudiPannello(): void {
    this.pannello.set(null);
  }

  /** Il form parte con il pin sulla posizione dell'utente, o sul centro mappa se non è nota. */
  protected apriNuovaSegnalazione(): void {
    const map = this.mappa();
    if (!map || !this.verificaLogin()) {
      return;
    }
    const posizione = this.posizioneUtente() ?? map.getCenter();
    this.vista.set('mappa');
    this.selezionata.set(null);
    this.posizioneNuova.set(posizione);
    this.pannello.set('nuova-posizione');
    this.centraNellaZonaLibera(posizione, ZOOM_POSIZIONE_UTENTE);
  }

  /** Passo 1: riporta il pin sulla posizione GPS e ci centra la mappa. */
  protected riportaPinSuUtente(): void {
    const posizione = this.posizioneUtente();
    if (posizione) {
      this.posizioneNuova.set(posizione);
      this.centraNellaZonaLibera(posizione, ZOOM_POSIZIONE_UTENTE);
    }
  }

  /** Passo 1 → 2: il punto dove è stato lasciato il pin diventa la posizione della segnalazione. */
  protected confermaPosizione(): void {
    this.pannello.set('nuova-dettagli');
    const posizione = this.posizioneNuova();
    if (posizione) {
      this.centraNellaZonaLibera(posizione);
    }
  }

  /** Passo 2 → 1 ("Cambia"): i dati del form restano, si riparte dal punto già scelto. */
  protected cambiaPosizione(): void {
    const posizione = this.posizioneNuova();
    this.pannello.set('nuova-posizione');
    if (posizione) {
      this.centraNellaZonaLibera(posizione);
    }
  }

  /**
   * Chiusura "morbida" della nuova segnalazione (tocco sulla mappa, Esc, X). Se il form ha dati
   * la decisione passa a lui, che chiede conferma: dal passo 1 si torna ai dettagli per mostrarla.
   */
  protected chiudiNuovaSegnalazione(): void {
    const form = this.formNuova();
    if (this.pannello() === 'nuova-posizione' && form?.haDati()) {
      this.pannello.set('nuova-dettagli');
      afterNextRender(() => this.formNuova()?.richiediChiusura(), { injector: this.injector });
      return;
    }
    if (this.pannello() === 'nuova-dettagli' && form) {
      form.richiediChiusura();
      return;
    }
    this.chiudiPannello();
  }

  /** Esc: chiude il dettaglio o, durante una nuova segnalazione, chiede di chiuderla. */
  protected gestisciEscape(): void {
    if (this.nuovaAperta()) {
      this.chiudiNuovaSegnalazione();
    } else {
      this.chiudiDettaglio();
    }
  }

  protected segnalazionePubblicata(segnalazione: Segnalazione): void {
    this.pannello.set(null);
    // La propria segnalazione deve vedersi anche se il filtro attivo la nasconderebbe.
    const filtro = this.gravitaFiltro();
    if (filtro !== null && filtro !== segnalazione.categoriaGravita) {
      this.scegliGravita(null);
    }
    this.segnalazioni.update((elenco) => [segnalazione, ...elenco]);
    this.idAppenaPubblicata.set(segnalazione.id);
    this.apriDettaglio(segnalazione);
  }

  /** Dalla lista: torna alla mappa, centra la segnalazione e ne apre il dettaglio. */
  protected selezionaDaLista(segnalazione: Segnalazione): void {
    const map = this.mappa();
    this.vista.set('mappa');
    if (map) {
      map.setView([segnalazione.lat, segnalazione.lng], Math.max(map.getZoom(), 16), {
        animate: false,
      });
    }
    this.pannello.set(null);
    this.apriDettaglio(segnalazione);
  }

  /**
   * Link diretto a una segnalazione (es. "Apri sulla mappa" dal profilo): la si carica, si
   * centra la mappa e si apre il dettaglio. Il parametro viene poi tolto dall'URL, così un
   * ricaricamento non riapre la stessa segnalazione.
   */
  private apriSegnalazioneRichiesta(): void {
    const id = Number(this.rotta.snapshot.queryParamMap.get('segnalazione'));
    if (!Number.isInteger(id) || id <= 0) {
      return;
    }
    this.centraSuPrimaPosizione = false;
    void this.router.navigate([], {
      relativeTo: this.rotta,
      queryParams: { segnalazione: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.segnalazioneApi.ottieni(id).subscribe({
      next: (segnalazione) => {
        if (segnalazione.stato !== StatoSegnalazione.ATTIVA) {
          this.toast.info(this.transloco.translate('mappa.link.nonAttiva'));
          return;
        }
        this.selezionaDaLista(segnalazione);
      },
      error: () => this.toast.errore(this.transloco.translate('mappa.link.nonTrovata')),
    });
  }

  protected iconaCategoria(categoriaId: number): string {
    return this.iconePerCategoria().get(categoriaId) ?? NOME_ICONA_FALLBACK;
  }

  protected readonly classeGravita = classeGravita;
  protected readonly classePallinoGravita = classePallinoGravita;
  protected readonly chiaveGravita = chiaveGravita;

  /** Toccare di nuovo il filtro attivo torna a "Tutte". Il dettaglio di una segnalazione nascosta si chiude. */
  protected scegliGravita(gravita: Gravita | null): void {
    const nuovo = this.gravitaFiltro() === gravita ? null : gravita;
    this.gravitaFiltro.set(nuovo);
    const aperta = this.selezionata();
    if (nuovo !== null && aperta && aperta.categoriaGravita !== nuovo) {
      this.selezionata.set(null);
    }
    try {
      if (nuovo === null) {
        localStorage.removeItem(CHIAVE_FILTRO_GRAVITA);
      } else {
        localStorage.setItem(CHIAVE_FILTRO_GRAVITA, String(nuovo));
      }
    } catch {
      // Storage non disponibile (es. navigazione privata): la scelta vale solo per questa visita.
    }
  }

  /**
   * Chiede le segnalazioni della vista (raggio = distanza centro-angolo), ma solo se la vista
   * esce dall'area già caricata o se quella è più vecchia di VALIDITA_AREA_MS. Si carica un
   * raggio più ampio della vista, così i piccoli spostamenti non generano richieste.
   */
  private richiediSegnalazioni(map: LeafletMap): void {
    const centro = map.getCenter();
    const raggioVista = Math.min(
      centro.distanceTo(map.getBounds().getNorthEast()),
      RAGGIO_MASSIMO_METRI,
    );
    const caricata = this.areaCaricata;
    if (
      caricata &&
      Date.now() - caricata.istante < VALIDITA_AREA_MS &&
      caricata.centro.distanceTo(centro) + raggioVista <= caricata.raggioMetri
    ) {
      return;
    }
    const raggioMetri = Math.min(raggioVista * MARGINE_AREA_CARICATA, RAGGIO_MASSIMO_METRI);
    this.areaRichiesta.next({ centro, raggioMetri: Math.ceil(raggioMetri) });
  }

  /** Riporta la vista sul pallino dell'utente dopo che ha spostato la mappa. */
  protected centraSuPosizione(): void {
    const map = this.mappa();
    const posizione = this.posizioneUtente();
    if (!map || !posizione) {
      return;
    }
    const riduciMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.flyTo(posizione, ZOOM_POSIZIONE_UTENTE, { animate: !riduciMovimento });
  }

  /**
   * Il consenso lo chiede il browser alla prima chiamata della Geolocation API.
   * La mappa si centra solo sulla prima posizione ricevuta: gli aggiornamenti
   * successivi spostano il pallino senza togliere all'utente il controllo della vista.
   */
  private seguiPosizioneUtente(map: LeafletMap): void {
    if (!('geolocation' in navigator)) {
      this.avvisoPosizione.set('mappa.posizione.nonDisponibile');
      return;
    }

    this.idWatch = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const posizione = latLng(coords.latitude, coords.longitude);
        this.avvisoPosizione.set(null);
        this.posizioneUtente.set(posizione);

        if (this.pallino && this.cerchioPrecisione) {
          this.pallino.setLatLng(posizione);
          this.cerchioPrecisione.setLatLng(posizione).setRadius(coords.accuracy);
          return;
        }

        // Bordo sottile: fa capire dove finisce l'area di precisione anche sulla mappa grigia.
        this.cerchioPrecisione = circle(posizione, {
          radius: coords.accuracy,
          color: COLORE_POSIZIONE,
          weight: 1,
          opacity: 0.35,
          fillColor: COLORE_POSIZIONE,
          fillOpacity: 0.15,
          interactive: false,
        }).addTo(map);
        // Marker HTML (non un cerchio SVG): sta nel pane dei marker, sopra aloni, cerchio di
        // precisione e marker delle segnalazioni (anche quella attiva, +1000), così resta visibile
        // anche segnalando sulla propria posizione; sotto solo il pin della nuova segnalazione
        // (+2000). Non interattivo: i clic passano alla segnalazione sottostante.
        const etichetta = this.transloco.translate('mappa.posizione.tu');
        this.pallino = marker(posizione, {
          icon: divIcon({
            className: '',
            html: `<span class="pallino-utente" style="--colore-posizione: ${COLORE_POSIZIONE}"></span>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
          interactive: false,
          keyboard: false,
          zIndexOffset: 1500,
          title: etichetta,
          alt: etichetta,
        }).addTo(map);
        if (this.centraSuPrimaPosizione) {
          map.setView(posizione, ZOOM_POSIZIONE_UTENTE);
        }
      },
      (errore) => {
        // Se il pallino è già sulla mappa, un timeout isolato non merita un avviso.
        if (errore.code !== errore.PERMISSION_DENIED && this.pallino) {
          return;
        }
        this.avvisoPosizione.set(
          errore.code === errore.PERMISSION_DENIED
            ? 'mappa.posizione.negata'
            : 'mappa.posizione.nonDisponibile',
        );
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 },
    );
  }
}
