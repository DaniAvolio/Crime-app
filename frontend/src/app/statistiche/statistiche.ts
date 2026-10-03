import { NgClass } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { LeafletDirective } from '@bluehalo/ngx-leaflet';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { Map as LeafletMap, MapOptions, latLng } from 'leaflet';
import { EMPTY, catchError, debounceTime, filter, forkJoin, switchMap, tap } from 'rxjs';
import { AuthService } from '../auth/auth';
import { nomeCategoria } from '../categorie/categoria-i18n';
import { CategorieStore } from '../categorie/categorie-store';
import { GRAVITA, Gravita } from '../models/gravita.model';
import { chiaveGravita } from '../shared/gravita';
import { LinguaService } from '../shared/lingua';
import {
  STILI_PER_TEMA,
  aggiungiLuoghiUtili,
  attribuzioneCompatta,
  ignoraIconeMancanti,
  impostaAttribuzioneAperta,
  sfondoOpenFreeMap,
  urlStileOpenFreeMap,
} from '../shared/mappa-base';
import { TemaService } from '../shared/tema';
import { disegnaCalore } from './calore';
import { GraficoAndamento } from './grafici/andamento';
import { GraficoCategorie } from './grafici/categorie-statistiche';
import { GraficoFasceOrarie } from './grafici/fasce-orarie';
import {
  CellaCalore,
  FiltriStatistiche,
  ModerazioneStatistiche,
  RiepilogoStatistiche,
  Riquadro,
  StatisticheApi,
} from './statistiche-api';

/** Periodi rapidi (giorni fino a oggi compreso) o un intervallo scelto a mano. */
export type Preset = '7' | '30' | '90' | '365' | 'personalizzato';
const PRESET: readonly Preset[] = ['7', '30', '90', '365', 'personalizzato'];

/** Senza posizione nell'URL né geolocalizzazione già concessa: centro di Torino. */
const CENTRO_PREDEFINITO: [number, number] = [45.0703, 7.6869];
const ZOOM_PREDEFINITO = 12;
const ZOOM_POSIZIONE_UTENTE = 14;
const ZOOM_ZONA_CALDA = 15;
const ATTESA_MS = 300;

function iso(data: Date): string {
  const due = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${due(data.getMonth() + 1)}-${due(data.getDate())}`;
}

function giorniFa(giorni: number): string {
  const data = new Date();
  data.setDate(data.getDate() - giorni);
  return iso(data);
}

function numeroOppureNull(valore: string | null): number | null {
  const numero = valore === null || valore === '' ? NaN : Number(valore);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Statistiche pubbliche: mappa di calore e, per l'area visibile, numeri e grafici (andamento,
 * fasce orarie, categorie). Spostando o zoomando la mappa tutto si ricalcola sull'area nuova;
 * filtri e vista restano nell'URL, così la pagina si può condividere. Gli admin vedono anche
 * la moderazione del periodo. Le aggregazioni sono tutte nel backend (StatisticheApi).
 */
@Component({
  selector: 'app-statistiche',
  standalone: true,
  imports: [
    LeafletDirective,
    TranslocoDirective,
    NgClass,
    GraficoAndamento,
    GraficoFasceOrarie,
    GraficoCategorie,
  ],
  templateUrl: './statistiche.html',
})
export class Statistiche {
  private readonly api = inject(StatisticheApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly lingua = inject(LinguaService);
  private readonly tema = inject(TemaService);
  private readonly categorieStore = inject(CategorieStore);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);

  protected readonly presetDisponibili = PRESET;
  protected readonly livelliGravita = GRAVITA;
  protected readonly chiaveGravita = chiaveGravita;

  // ------------------------------------------------------------------ filtri (dall'URL)
  private readonly parametri = this.route.snapshot.queryParamMap;
  protected readonly preset = signal<Preset>(
    PRESET.includes(this.parametri.get('p') as Preset) ? (this.parametri.get('p') as Preset) : '30',
  );
  protected readonly dalPersonalizzato = signal(this.parametri.get('dal') ?? giorniFa(29));
  protected readonly alPersonalizzato = signal(this.parametri.get('al') ?? iso(new Date()));
  protected readonly gravita = signal<Gravita | null>(
    numeroOppureNull(this.parametri.get('g')) as Gravita | null,
  );
  protected readonly categoriaId = signal<number | null>(numeroOppureNull(this.parametri.get('c')));

  protected readonly filtri = computed<FiltriStatistiche>(() => {
    const preset = this.preset();
    const [dal, al] =
      preset === 'personalizzato'
        ? [this.dalPersonalizzato(), this.alPersonalizzato()]
        : [giorniFa(Number(preset) - 1), iso(new Date())];
    return { dal, al, gravita: this.gravita(), categoriaId: this.categoriaId() };
  });

  /** Categorie del filtro, raggruppate per gravità (come altrove nell'app). */
  protected readonly gruppiCategorie = computed(() => {
    const lingua = this.lingua.attiva();
    return ([3, 2, 1] as Gravita[]).map((gravita) => ({
      gravita,
      categorie: this.categorieStore
        .categorie()
        .filter((c) => c.gravita === gravita)
        .map((c) => ({ id: c.id, nome: nomeCategoria(c, lingua) }))
        .sort((a, b) => a.nome.localeCompare(b.nome, lingua)),
    }));
  });

  // ------------------------------------------------------------------ mappa
  private readonly sfondo = sfondoOpenFreeMap(STILI_PER_TEMA[this.tema.temaMappa()]);
  private stileSfondo = STILI_PER_TEMA[this.tema.temaMappa()];
  private readonly mappa = signal<LeafletMap | null>(null);
  /** Area e zoom visibili, aggiornati a fine spostamento. */
  private readonly vista = signal<{ riquadro: Riquadro; zoom: number } | null>(null);

  protected readonly options: MapOptions = {
    layers: [this.sfondo],
    center: latLng(
      numeroOppureNull(this.parametri.get('lat')) ?? CENTRO_PREDEFINITO[0],
      numeroOppureNull(this.parametri.get('lng')) ?? CENTRO_PREDEFINITO[1],
    ),
    zoom: numeroOppureNull(this.parametri.get('z')) ?? ZOOM_PREDEFINITO,
    minZoom: 5,
    maxZoom: 18,
  };

  // ------------------------------------------------------------------ dati
  protected readonly riepilogo = signal<RiepilogoStatistiche | null>(null);
  private readonly celle = signal<CellaCalore[]>([]);
  private zoomCelle = ZOOM_PREDEFINITO;
  protected readonly caricando = signal(true);
  protected readonly errore = signal(false);
  protected readonly moderazione = signal<ModerazioneStatistiche | null>(null);

  constructor() {
    this.categorieStore.carica();

    // Tema della mappa: stesso sfondo della mappa principale; la heatmap si ridisegna a ogni
    // caricamento di stile (vedi onMapReady).
    effect(() => {
      const stile = STILI_PER_TEMA[this.tema.temaMappa()];
      if (this.mappa() && stile !== this.stileSfondo) {
        this.stileSfondo = stile;
        this.sfondo.getMaplibreMap().setStyle(urlStileOpenFreeMap(stile));
      }
    });

    // Celle o tema cambiati: si aggiorna il livello di calore.
    effect(() => {
      const celle = this.celle();
      const tema = this.tema.temaMappa();
      if (this.mappa()) {
        untracked(() => disegnaCalore(this.sfondo.getMaplibreMap(), celle, this.zoomCelle, tema));
      }
    });

    // Filtri o area cambiati: una richiesta (mappa + riepilogo) dopo una breve pausa; una nuova
    // annulla quella in corso. Mentre carica restano i dati precedenti, attenuati.
    toObservable(computed(() => ({ filtri: this.filtri(), vista: this.vista() })))
      .pipe(
        filter((stato) => stato.vista !== null),
        tap(() => this.caricando.set(true)),
        debounceTime(ATTESA_MS),
        switchMap(({ filtri, vista }) =>
          forkJoin({
            celle: this.api.mappa(filtri, vista!.riquadro, vista!.zoom),
            riepilogo: this.api.riepilogo(filtri, vista!.riquadro),
          }).pipe(
            tap(() => (this.zoomCelle = vista!.zoom)),
            catchError(() => {
              this.errore.set(true);
              this.caricando.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ celle, riepilogo }) => {
        this.errore.set(false);
        this.celle.set(celle);
        this.riepilogo.set(riepilogo);
        this.caricando.set(false);
      });

    // Moderazione (solo admin): dipende dal periodo, non dall'area.
    toObservable(computed(() => (this.auth.isAdmin() ? this.filtri() : null)))
      .pipe(
        debounceTime(ATTESA_MS),
        switchMap((filtri) =>
          filtri
            ? this.api.moderazione(filtri.dal, filtri.al).pipe(catchError(() => EMPTY))
            : EMPTY,
        ),
        takeUntilDestroyed(),
      )
      .subscribe((dati) => this.moderazione.set(dati));

    // Filtri e vista nell'URL, senza aggiungere voci alla cronologia.
    effect(() => {
      const filtri = this.filtri();
      const preset = this.preset();
      const mappa = this.mappa();
      this.vista();
      if (!mappa) {
        return;
      }
      const centro = mappa.getCenter();
      untracked(() =>
        this.router.navigate([], {
          relativeTo: this.route,
          replaceUrl: true,
          queryParams: {
            p: preset,
            dal: preset === 'personalizzato' ? filtri.dal : null,
            al: preset === 'personalizzato' ? filtri.al : null,
            g: filtri.gravita,
            c: filtri.categoriaId,
            lat: centro.lat.toFixed(4),
            lng: centro.lng.toFixed(4),
            z: mappa.getZoom(),
          },
        }),
      );
    });
  }

  protected onMapReady(map: LeafletMap): void {
    ignoraIconeMancanti(this.sfondo);
    aggiungiLuoghiUtili(this.sfondo, () => this.stileSfondo === STILI_PER_TEMA.scuro);
    attribuzioneCompatta(map, this.transloco.translate('mappa.crediti'));
    map.on('click', () => impostaAttribuzioneAperta(map, false));
    this.sfondo
      .getMaplibreMap()
      .on('style.load', () =>
        disegnaCalore(
          this.sfondo.getMaplibreMap(),
          this.celle(),
          this.zoomCelle,
          this.tema.temaMappa(),
        ),
      );
    map.on('moveend', () => this.aggiornaVista(map));
    // Il contenitore cresce col layout (flex): Leaflet e lo sfondo vanno riallineati alla
    // nuova dimensione, altrimenti la parte nuova resta grigia.
    const osservatore = new ResizeObserver(() => map.invalidateSize());
    osservatore.observe(map.getContainer());
    this.destroyRef.onDestroy(() => osservatore.disconnect());
    this.mappa.set(map);
    this.aggiornaVista(map);
    this.centraSuUtenteSeConcesso(map);
  }

  private aggiornaVista(map: LeafletMap): void {
    const limiti = map.getBounds();
    this.vista.set({
      riquadro: {
        minLat: Math.max(-90, limiti.getSouth()),
        minLng: Math.max(-180, limiti.getWest()),
        maxLat: Math.min(90, limiti.getNorth()),
        maxLng: Math.min(180, limiti.getEast()),
      },
      zoom: map.getZoom(),
    });
  }

  /**
   * Senza posizione nell'URL si parte dalla zona dell'utente, ma solo se ha già concesso la
   * geolocalizzazione (es. dalla mappa): questa pagina non chiede permessi.
   */
  private centraSuUtenteSeConcesso(map: LeafletMap): void {
    if (this.parametri.has('lat') || !navigator.permissions || !navigator.geolocation) {
      return;
    }
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((stato) => {
        if (stato.state !== 'granted') {
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (posizione) =>
            map.setView(
              [posizione.coords.latitude, posizione.coords.longitude],
              ZOOM_POSIZIONE_UTENTE,
            ),
          () => undefined,
          { maximumAge: 300_000, timeout: 8_000 },
        );
      })
      .catch(() => undefined);
  }

  // ------------------------------------------------------------------ azioni
  protected scegliPreset(preset: Preset): void {
    this.preset.set(preset);
  }

  protected scegliDal(valore: string): void {
    if (valore) {
      this.dalPersonalizzato.set(valore);
    }
  }

  protected scegliAl(valore: string): void {
    if (valore) {
      this.alPersonalizzato.set(valore);
    }
  }

  protected scegliGravita(valore: string): void {
    this.gravita.set(valore === '' ? null : (Number(valore) as Gravita));
  }

  protected scegliCategoria(valore: string): void {
    this.categoriaId.set(valore === '' ? null : Number(valore));
  }

  protected mostraZona(cella: CellaCalore): void {
    const map = this.mappa();
    map?.setView([cella.lat, cella.lng], Math.max(map.getZoom(), ZOOM_ZONA_CALDA));
    map?.getContainer().scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ------------------------------------------------------------------ numeri derivati
  protected readonly variazione = computed(() => {
    const r = this.riepilogo();
    if (!r || r.totalePeriodoPrecedente === 0) {
      return null;
    }
    return Math.round(((r.totale - r.totalePeriodoPrecedente) / r.totalePeriodoPrecedente) * 100);
  });

  protected readonly quotaGravi = computed(() => {
    const r = this.riepilogo();
    return r && r.totale > 0 ? Math.round((r.gravi / r.totale) * 100) : null;
  });

  /** Giorno della settimana e ora con più segnalazioni (somme sulle fasce). */
  protected readonly piuARischio = computed(() => {
    const r = this.riepilogo();
    if (!r || r.fasce.length === 0) {
      return null;
    }
    const perGiorno = new Map<number, number>();
    const perOra = new Map<number, number>();
    for (const f of r.fasce) {
      perGiorno.set(f.giornoSettimana, (perGiorno.get(f.giornoSettimana) ?? 0) + f.numero);
      perOra.set(f.ora, (perOra.get(f.ora) ?? 0) + f.numero);
    }
    const massimo = (mappa: Map<number, number>) =>
      [...mappa.entries()].reduce((a, b) => (b[1] > a[1] ? b : a));
    return { giorno: massimo(perGiorno)[0], ora: massimo(perOra)[0] };
  });

  protected nomeGiorno(giorno: number): string {
    const lunedi = new Date(2024, 0, 1);
    return new Intl.DateTimeFormat(this.lingua.attiva(), { weekday: 'long' }).format(
      new Date(lunedi.getTime() + (giorno - 1) * 86_400_000),
    );
  }

  protected fasciaOraria(ora: number): string {
    const due = (n: number) => String(n).padStart(2, '0');
    return `${due(ora)}:00–${due((ora + 1) % 24)}:00`;
  }

  protected formattaNumero(valore: number): string {
    return new Intl.NumberFormat(this.lingua.attiva()).format(valore);
  }

  protected formattaData(isoData: string): string {
    return new Intl.DateTimeFormat(this.lingua.attiva(), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(`${isoData}T00:00:00`));
  }

  protected formattaOre(ore: number): string {
    return new Intl.NumberFormat(this.lingua.attiva(), { maximumFractionDigits: 1 }).format(ore);
  }

  protected readonly titoloAndamento = computed(() => {
    this.lingua.attiva();
    const r = this.riepilogo();
    return this.transloco.translate(`statistiche.andamento.titolo${r?.granularita ?? 'GIORNO'}`);
  });

  protected readonly titoloFasce = computed(() => {
    this.lingua.attiva();
    return this.transloco.translate('statistiche.fasce.titolo');
  });
}
