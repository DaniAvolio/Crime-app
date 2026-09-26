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
  CircleMarker,
  circle,
  circleMarker,
  divIcon,
  LatLng,
  latLng,
  layerGroup,
  Map as LeafletMap,
  MaplibreGL,
  MapOptions,
  Marker,
  marker,
} from 'leaflet';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import { Subject, catchError, debounceTime, finalize, of, switchMap, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { CategoriaApi } from '../categorie/categoria-api';
import { SegnalazioneApi } from '../gestione/segnalazioni/segnalazione-api';
import { Segnalazione, StatoSegnalazione } from '../models/segnalazione.model';
import { NOME_ICONA_FALLBACK, svgIcona } from '../shared/icone-categoria';
import { Tema, TemaService } from '../shared/tema';
import { Categoria } from '../models/categoria.model';
import { formattaData, formattaDistanza } from './formattazione';
import { ListaSegnalazioni } from './lista-segnalazioni';
import { NavbarMappa, VistaMappa } from './navbar-mappa';
import { NuovaSegnalazione } from './nuova-segnalazione';
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

/** Stesso breakpoint di `sm:` di Tailwind: sotto, il dettaglio è un pannello dal basso. */
const MEDIA_MOBILE = '(max-width: 639px)';
const SOGLIA_TRASCINAMENTO_PX = 40;
/** Aprendo una segnalazione da uno zoom più lontano di così, ci si avvicina prima di centrarla. */
const ZOOM_MINIMO_CENTRATURA = 15;

interface AreaVisibile {
  centro: LatLng;
  raggioMetri: number;
}

/**
 * Stili vettoriali OpenFreeMap (open source, gratuiti, senza chiave), resi da MapLibre GL
 * dentro un layer Leaflet: pallino e overlay restano layer Leaflet normali sopra la mappa.
 */
function sfondoOpenFreeMap(stile: string): MaplibreGL {
  // L'attribuzione (OpenFreeMap, OpenMapTiles, OSM) arriva dalle sorgenti dello stile: il
  // plugin la inserisce nel controllo di Leaflet al "load" di MapLibre.
  return maplibreGL({ style: `https://tiles.openfreemap.org/styles/${stile}` });
}

/**
 * Lo stile Bright chiede icone (es. "gate", "bollard", "office") assenti dallo sprite di
 * OpenFreeMap, e MapLibre logga un warning per ognuna. Registrarle come immagine vuota non
 * cambia nulla a video (l'icona non esiste comunque) ma evita il rumore in console.
 * Va ripetuto a ogni addTo: il plugin ricrea la mappa MapLibre ogni volta.
 */
function ignoraIconeMancanti(sfondo: MaplibreGL): void {
  const glMap = sfondo.getMaplibreMap();
  glMap.setMissingStyleImageResolver((id) => {
    if (!glMap.hasImage(id)) {
      glMap.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
    }
  });
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
    ListaSegnalazioni,
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
  protected readonly erroreSegnalazioni = signal(false);

  /** Stato della risposta a "è ancora in atto?" per la segnalazione aperta. */
  protected readonly invioConferma = signal(false);
  protected readonly esitoConferma = signal<'grazie' | 'errore' | null>(null);

  /** Solo mobile: il pannello di dettaglio si apre compatto e si espande su richiesta. */
  protected readonly pannelloEspanso = signal(false);
  /** Spostamento verso il basso (px) mentre l'utente trascina la maniglia del pannello. */
  protected readonly spostamentoPannello = signal(0);
  private inizioTrascinamentoY: number | null = null;
  private trascinamentoAppenaFinito = false;
  /** Avviso mostrato quando i voti "non più in atto" hanno chiuso la segnalazione aperta. */
  protected readonly segnalazioneChiusa = signal(false);

  /** Distanza dal pallino alla segnalazione aperta, se la posizione dell'utente è nota. */
  protected readonly distanzaSelezionata = computed(() => {
    const segnalazione = this.selezionata();
    const posizione = this.posizioneUtente();
    if (!segnalazione || !posizione) {
      return null;
    }
    return formattaDistanza(posizione.distanceTo([segnalazione.lat, segnalazione.lng]));
  });

  /** Vista attiva, scelta dalla navbar in basso. */
  protected readonly vista = signal<VistaMappa>('mappa');
  /** Pannello aperto dalla navbar (il dettaglio segnalazione è governato da `selezionata`). */
  protected readonly pannello = signal<'nuova' | 'soccorsi' | null>(null);

  protected readonly categorie = signal<Categoria[]>([]);
  protected readonly categorieAttive = computed(() => this.categorie().filter((c) => c.attiva));

  /** Punto della nuova segnalazione: parte dalla posizione dell'utente, si sposta col pin. */
  protected readonly posizioneNuova = signal<LatLng | null>(null);
  protected readonly pinSpostato = signal(false);
  /** Id dell'ultima segnalazione pubblicata, per confermarlo nel suo pannello di dettaglio. */
  protected readonly idAppenaPubblicata = signal<number | null>(null);

  /** Su mobile pulsante "torna a me" e avvisi lasciano spazio ai pannelli dal basso. */
  protected readonly pannelloInBassoAperto = computed(
    () => this.selezionata() !== null || this.pannello() === 'nuova',
  );

  /** Da dove la lista misura le distanze: l'utente se la posizione è nota, sennò il centro mappa. */
  protected readonly riferimentoLista = computed(
    () => this.posizioneUtente() ?? this.centroMappa(),
  );
  private readonly centroMappa = signal(latLng(45.3181, 8.8589));
  private pinNuova: Marker | null = null;

  private readonly tema = inject(TemaService);
  private readonly transloco = inject(TranslocoService);
  private readonly segnalazioneApi = inject(SegnalazioneApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly formNuova = viewChild(NuovaSegnalazione);

  /** Id (e non oggetto) così l'esito del voto non si azzera quando la segnalazione aperta si aggiorna. */
  private readonly idSelezionata = computed(() => this.selezionata()?.id ?? null);

  /** categoriaId -> nome icona Lucide, per disegnare il marker con l'icona della categoria. */
  protected readonly iconePerCategoria = signal(new Map<number, string>());
  private readonly areaRichiesta = new Subject<AreaVisibile>();
  private readonly livelloSegnalazioni = layerGroup();

  /** Signal (e non campo semplice) così l'effect del tema riparte quando la mappa è pronta. */
  private readonly mappa = signal<LeafletMap | null>(null);
  private idWatch: number | null = null;
  private pallino: CircleMarker | null = null;
  private cerchioPrecisione: Circle | null = null;

  /** Uno sfondo per tema, scambiati dal toggle del tema dell'app (per ora entrambi "Bright"). */
  private readonly sfondi: Record<Tema, MaplibreGL> = {
    chiaro: sfondoOpenFreeMap('bright'),
    scuro: sfondoOpenFreeMap('bright'),
  };

  /** Centro di default (Lombardia): resta tale se l'utente non condivide la posizione. */
  protected readonly options: MapOptions = {
    layers: [this.sfondi[this.tema.temaAttuale()]],
    zoom: 13,
    center: latLng(45.3181, 8.8589),
  };

  constructor() {
    effect(() => {
      const map = this.mappa();
      const tema = this.tema.temaAttuale();
      if (!map) {
        return;
      }
      for (const [nome, sfondo] of Object.entries(this.sfondi)) {
        if (nome === tema) {
          sfondo.addTo(map);
          ignoraIconeMancanti(sfondo);
        } else {
          sfondo.remove();
        }
      }
    });

    // Aprendo un'altra segnalazione, l'esito del voto precedente non la riguarda più.
    effect(() => {
      this.idSelezionata();
      this.esitoConferma.set(null);
    });

    // Ridisegna i marker quando cambiano i dati, le icone o la selezione.
    effect(() => {
      const icone = this.iconePerCategoria();
      const selezionataId = this.selezionata()?.id;
      this.livelloSegnalazioni.clearLayers();
      for (const segnalazione of this.segnalazioni()) {
        const attiva = segnalazione.id === selezionataId;
        const icona = icone.get(segnalazione.categoriaId) ?? NOME_ICONA_FALLBACK;
        circle([segnalazione.lat, segnalazione.lng], {
          radius: RAGGIO_INCERTEZZA_METRI,
          stroke: false,
          fillColor: attiva ? '#dc2626' : '#6b7280',
          fillOpacity: attiva ? 0.16 : 0.18,
          interactive: false,
          className: 'alone-segnalazione',
        }).addTo(this.livelloSegnalazioni);
        marker([segnalazione.lat, segnalazione.lng], {
          icon: divIcon({
            className: '',
            html: `<span class="marker-segnalazione${attiva ? ' marker-segnalazione--attiva' : ''}">${svgIcona(icona)}</span>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          }),
          title: segnalazione.categoriaNome,
          alt: segnalazione.categoriaNome,
          keyboard: true,
          riseOnHover: true,
          zIndexOffset: attiva ? 1000 : 0,
        })
          .on('click', () => this.apriDettaglio(segnalazione))
          .addTo(this.livelloSegnalazioni);
      }
    });

    // Pin trascinabile della nuova segnalazione: esiste solo mentre il form è aperto.
    effect(() => {
      const map = this.mappa();
      const posizione = this.posizioneNuova();
      if (!map || this.pannello() !== 'nuova' || !posizione) {
        this.pinNuova?.remove();
        this.pinNuova = null;
        return;
      }
      if (this.pinNuova) {
        this.pinNuova.setLatLng(posizione);
        return;
      }
      this.pinNuova = marker(posizione, {
        draggable: true,
        autoPan: true,
        zIndexOffset: 2000,
        title: this.transloco.translate('mappa.nuova.pin'),
        alt: this.transloco.translate('mappa.nuova.pin'),
        icon: divIcon({
          className: '',
          html: `<span class="pin-nuova-segnalazione">${svgIcona('plus')}</span>`,
          iconSize: [40, 40],
          // La punta della goccia (angolo ruotato di 45°) sta ~28px sotto il centro.
          iconAnchor: [20, 48],
        }),
      })
        .on('dragend', () => {
          this.posizioneNuova.set(this.pinNuova!.getLatLng());
          this.pinSpostato.set(true);
        })
        .addTo(map);
    });

    // debounce: un trascinamento produce molti moveend; switchMap scarta le risposte superate.
    this.areaRichiesta
      .pipe(
        debounceTime(300),
        switchMap(({ centro, raggioMetri }) =>
          this.segnalazioneApi.vicine(centro.lat, centro.lng, raggioMetri).pipe(
            tap(() => this.erroreSegnalazioni.set(false)),
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

    inject(CategoriaApi)
      .elenca()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (categorie) => {
          this.categorie.set(categorie);
          this.iconePerCategoria.set(
            new Map(categorie.map((c) => [c.id, c.icona ?? NOME_ICONA_FALLBACK])),
          );
        },
        // Senza categorie i marker usano l'icona di fallback: non serve un avviso dedicato.
        error: () => {},
      });

    inject(DestroyRef).onDestroy(() => {
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
    map.on('moveend', () => {
      this.centroMappa.set(map.getCenter());
      this.richiediSegnalazioni(map);
    });
    // Un tocco sulla mappa chiude il pannello aperto, come per il dettaglio. Il form può avere
    // dati non inviati: decide lui se chiudere subito o chiedere conferma.
    map.on('click', () => {
      if (this.pannello() === 'nuova') {
        this.formNuova()?.richiediChiusura();
      } else {
        this.selezionata.set(null);
      }
    });
    this.richiediSegnalazioni(map);
    this.seguiPosizioneUtente(map);
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
    if (this.pannello() === 'nuova') {
      this.formNuova()?.richiediChiusura();
      return;
    }
    this.selezionata.set(segnalazione);
    this.pannelloEspanso.set(false);
    this.centraNellaZonaLibera(latLng(segnalazione.lat, segnalazione.lng));
  }

  /**
   * Centra `posizione` nella parte di mappa non coperta: sopra il pannello e la navbar su
   * mobile, a sinistra del pannello laterale su desktop. Le misure si leggono dopo il render,
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
        const radice = this.host.nativeElement;
        const pannello = radice.querySelector<HTMLElement>('.pannello-mappa');
        const navbar = radice.querySelector<HTMLElement>('app-navbar-mappa nav');
        const { x: larghezza, y: altezza } = map.getSize();
        const mobile = matchMedia(MEDIA_MOBILE).matches;
        const bordoDestro = !mobile && pannello ? pannello.offsetLeft : larghezza;
        const bordoBasso = Math.min(
          navbar ? navbar.offsetTop : altezza,
          mobile && pannello ? pannello.offsetTop : altezza,
        );
        const punto = map.latLngToContainerPoint(posizione);
        const riduciMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
        map.panBy([punto.x - bordoDestro / 2, punto.y - bordoBasso / 2], {
          animate: !riduciMovimento,
        });
      },
      { injector: this.injector },
    );
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

  protected chiudiAvvisoChiusura(): void {
    this.segnalazioneChiusa.set(false);
  }

  /**
   * Risposta a "è ancora in atto?". Il backend restituisce la segnalazione aggiornata: se è
   * ancora ATTIVA ha la nuova scadenza, altrimenti i voti "no" l'hanno chiusa e va tolta.
   */
  protected conferma(ancoraInAtto: boolean): void {
    const segnalazione = this.selezionata();
    if (!segnalazione || this.invioConferma()) {
      return;
    }
    this.invioConferma.set(true);
    this.esitoConferma.set(null);
    this.segnalazioneApi
      .conferma(segnalazione.id, { utenteId: environment.utenteCorrenteId, ancoraInAtto })
      .pipe(
        finalize(() => this.invioConferma.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (aggiornata) => {
          const ancoraAperta = this.idSelezionata() === aggiornata.id;
          if (aggiornata.stato === StatoSegnalazione.ATTIVA) {
            this.segnalazioni.update((elenco) =>
              elenco.map((s) => (s.id === aggiornata.id ? aggiornata : s)),
            );
            if (ancoraAperta) {
              this.selezionata.set(aggiornata);
              this.esitoConferma.set('grazie');
            }
            return;
          }
          this.segnalazioni.update((elenco) => elenco.filter((s) => s.id !== aggiornata.id));
          if (ancoraAperta) {
            this.selezionata.set(null);
          }
          this.segnalazioneChiusa.set(true);
        },
        error: () => {
          if (this.idSelezionata() === segnalazione.id) {
            this.esitoConferma.set('errore');
          }
        },
      });
  }

  protected formattaData(iso: string): string {
    return formattaData(iso, this.transloco.getActiveLang());
  }

  protected cambiaVista(vista: VistaMappa): void {
    this.vista.set(vista);
    if (vista === 'lista') {
      this.selezionata.set(null);
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
    if (!map) {
      return;
    }
    const posizione = this.posizioneUtente() ?? map.getCenter();
    this.vista.set('mappa');
    this.selezionata.set(null);
    this.posizioneNuova.set(posizione);
    this.pinSpostato.set(false);
    this.pannello.set('nuova');
    this.centraNellaZonaLibera(posizione);
  }

  /** Dal form: riporta il pin (e la mappa) sulla posizione GPS dell'utente. */
  protected riportaPinSuUtente(): void {
    const posizione = this.posizioneUtente();
    if (!posizione) {
      return;
    }
    this.posizioneNuova.set(posizione);
    this.pinSpostato.set(false);
    this.centraNellaZonaLibera(posizione);
  }

  /** Esc: chiude il dettaglio o, con il form aperto, chiede di chiuderlo (come un tocco sulla mappa). */
  protected gestisciEscape(): void {
    if (this.pannello() === 'nuova') {
      this.formNuova()?.richiediChiusura();
    } else {
      this.chiudiDettaglio();
    }
  }

  protected segnalazionePubblicata(segnalazione: Segnalazione): void {
    this.pannello.set(null);
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

  protected iconaCategoria(categoriaId: number): string {
    return this.iconePerCategoria().get(categoriaId) ?? NOME_ICONA_FALLBACK;
  }

  /** Raggio = distanza centro-angolo della vista, così la richiesta copre tutto lo schermo. */
  private richiediSegnalazioni(map: LeafletMap): void {
    const centro = map.getCenter();
    const raggioMetri = Math.min(
      centro.distanceTo(map.getBounds().getNorthEast()),
      RAGGIO_MASSIMO_METRI,
    );
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

        this.cerchioPrecisione = circle(posizione, {
          radius: coords.accuracy,
          stroke: false,
          fillColor: COLORE_POSIZIONE,
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(map);
        this.pallino = circleMarker(posizione, {
          radius: 8,
          color: '#ffffff',
          weight: 3,
          fillColor: COLORE_POSIZIONE,
          fillOpacity: 1,
          interactive: false,
        }).addTo(map);
        map.setView(posizione, ZOOM_POSIZIONE_UTENTE);
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
