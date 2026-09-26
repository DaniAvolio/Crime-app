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
import { Subject, catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { CategoriaApi } from '../categorie/categoria-api';
import { SegnalazioneApi } from '../gestione/segnalazioni/segnalazione-api';
import { Segnalazione } from '../models/segnalazione.model';
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

/** Zoom a livello di quartiere usato quando la posizione dell'utente è nota. */
const ZOOM_POSIZIONE_UTENTE = 16;

const COLORE_POSIZIONE = '#2563eb';

/** Oltre questo raggio (zoom molto basso) non ha senso chiedere tutte le segnalazioni. */
const RAGGIO_MASSIMO_METRI = 20_000;

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
  imports: [LeafletDirective, TranslocoDirective, LucideDynamicIcon],
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

    // Ridisegna i marker quando cambiano i dati, le icone o la selezione.
    effect(() => {
      const icone = this.iconePerCategoria();
      const selezionataId = this.selezionata()?.id;
      this.livelloSegnalazioni.clearLayers();
      for (const segnalazione of this.segnalazioni()) {
        const attiva = segnalazione.id === selezionataId;
        const icona = icone.get(segnalazione.categoriaId) ?? NOME_ICONA_FALLBACK;
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
          .on('click', () => this.selezionata.set(segnalazione))
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
