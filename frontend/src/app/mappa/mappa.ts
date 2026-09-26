import { NgClass } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
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
/** Distanza minima dai bordi della mappa per considerare visibile il marker selezionato. */
const MARGINE_PX = 48;

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
  imports: [LeafletDirective, TranslocoDirective, LucideDynamicIcon, NgClass],
  templateUrl: './mappa.html',
  host: { '(document:keydown.escape)': 'chiudiDettaglio()' },
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
    const metri = posizione.distanceTo([segnalazione.lat, segnalazione.lng]);
    return metri < 1000 ? `${Math.round(metri / 10) * 10} m` : `${(metri / 1000).toFixed(1)} km`;
  });

  private readonly tema = inject(TemaService);
  private readonly transloco = inject(TranslocoService);
  private readonly segnalazioneApi = inject(SegnalazioneApi);
  private readonly destroyRef = inject(DestroyRef);

  /** Id (e non oggetto) così l'esito del voto non si azzera quando la segnalazione aperta si aggiorna. */
  private readonly idSelezionata = computed(() => this.selezionata()?.id ?? null);

  /** categoriaId -> nome icona Lucide, per disegnare il marker con l'icona della categoria. */
  private readonly iconePerCategoria = signal(new Map<number, string>());
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
        next: (categorie) =>
          this.iconePerCategoria.set(
            new Map(categorie.map((c) => [c.id, c.icona ?? NOME_ICONA_FALLBACK])),
          ),
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
    map.on('moveend', () => this.richiediSegnalazioni(map));
    map.on('click', () => this.selezionata.set(null));
    this.richiediSegnalazioni(map);
    this.seguiPosizioneUtente(map);
  }

  protected chiudiAvviso(): void {
    this.avvisoPosizione.set(null);
  }

  protected chiudiDettaglio(): void {
    this.selezionata.set(null);
  }

  /**
   * Su mobile il dettaglio è un pannello dal basso: la mappa si sposta perché il marker
   * resti visibile sopra il pannello invece di finirci sotto.
   */
  private apriDettaglio(segnalazione: Segnalazione): void {
    this.selezionata.set(segnalazione);
    this.pannelloEspanso.set(false);
    const map = this.mappa();
    if (!map || !matchMedia(MEDIA_MOBILE).matches) {
      return;
    }
    const { x: larghezza, y: altezza } = map.getSize();
    const punto = map.latLngToContainerPoint([segnalazione.lat, segnalazione.lng]);
    // Zona visibile: sotto il bordo alto, sopra il pannello (~45% dell'altezza), lontano dai lati.
    const fuoriX = punto.x < MARGINE_PX || punto.x > larghezza - MARGINE_PX;
    const fuoriY = punto.y < MARGINE_PX || punto.y > altezza * 0.45;
    if (fuoriX || fuoriY) {
      const riduciMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
      map.panBy([fuoriX ? punto.x - larghezza / 2 : 0, fuoriY ? punto.y - altezza * 0.3 : 0], {
        animate: !riduciMovimento,
      });
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
    return new Intl.DateTimeFormat(this.transloco.getActiveLang(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
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
