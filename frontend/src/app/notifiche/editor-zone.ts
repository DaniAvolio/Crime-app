import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { LeafletDirective } from '@bluehalo/ngx-leaflet';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import {
  Circle,
  LatLng,
  Map as LeafletMap,
  MapOptions,
  circle,
  latLng,
  latLngBounds,
  layerGroup,
} from 'leaflet';
import { ZonaNotifica } from '../models/preferenze-notifica.model';
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
import { ZonaNotificaRequest } from './notifiche-api';

export const ZONE_MASSIME = 5;
const RAGGIO_PREDEFINITO = 1000;
const CENTRO_PREDEFINITO: [number, number] = [45.0703, 7.6869];
const COLORE_ZONA = '#2563eb';
const COLORE_BOZZA = '#dc2626';

/** Bozza della zona in modifica: nuova (id null) o esistente. */
interface Bozza {
  id: number | null;
  nome: string;
  centro: LatLng | null;
  raggioMetri: number;
}

/**
 * Zone di notifica su una mappa: ogni zona è un cerchio; toccando la mappa (o con "Usa la mia
 * posizione") si sceglie il centro della zona in modifica, il raggio si regola con lo slider.
 * Il salvataggio lo fa la pagina (eventi salva/elimina), che poi passa le zone aggiornate.
 */
@Component({
  selector: 'app-editor-zone',
  standalone: true,
  imports: [LeafletDirective, TranslocoDirective, LucideDynamicIcon],
  templateUrl: './editor-zone.html',
  host: { class: 'block' },
})
export class EditorZone {
  readonly zone = input.required<ZonaNotifica[]>();
  readonly occupato = input(false);
  readonly salva = output<{ id: number | null; zona: ZonaNotificaRequest }>();
  readonly elimina = output<ZonaNotifica>();

  private readonly tema = inject(TemaService);
  private readonly transloco = inject(TranslocoService);

  protected readonly zoneMassime = ZONE_MASSIME;
  protected readonly bozza = signal<Bozza | null>(null);
  protected readonly erroreNome = signal(false);
  protected readonly localizzando = signal(false);
  protected readonly erroreGps = signal(false);
  protected readonly puoAggiungere = computed(() => this.zone().length < ZONE_MASSIME);

  private readonly sfondo = sfondoOpenFreeMap(STILI_PER_TEMA[this.tema.temaMappa()]);
  private stileSfondo = STILI_PER_TEMA[this.tema.temaMappa()];
  private readonly cerchi = layerGroup();
  private cerchioBozza: Circle | null = null;
  private readonly mappa = signal<LeafletMap | null>(null);
  private inquadrate = false;

  protected readonly options: MapOptions = {
    layers: [this.sfondo, this.cerchi],
    center: latLng(...CENTRO_PREDEFINITO),
    zoom: 12,
    minZoom: 5,
    maxZoom: 18,
  };

  constructor() {
    effect(() => {
      const stile = STILI_PER_TEMA[this.tema.temaMappa()];
      if (this.mappa() && stile !== this.stileSfondo) {
        this.stileSfondo = stile;
        this.sfondo.getMaplibreMap().setStyle(urlStileOpenFreeMap(stile));
      }
    });

    // Cerchi delle zone salvate (quella in modifica si disegna a parte, in rosso).
    effect(() => {
      const zone = this.zone();
      const inModifica = this.bozza()?.id ?? null;
      const map = this.mappa();
      this.cerchi.clearLayers();
      for (const zona of zone) {
        if (zona.id === inModifica) {
          continue;
        }
        circle([zona.lat, zona.lng], {
          radius: zona.raggioMetri,
          color: COLORE_ZONA,
          weight: 2,
          fillOpacity: 0.12,
        })
          .bindTooltip(zona.nome, {
            permanent: true,
            direction: 'center',
            className: 'etichetta-zona',
          })
          .addTo(this.cerchi);
      }
      if (map && !this.inquadrate && zone.length > 0) {
        this.inquadrate = true;
        this.inquadra(map, zone);
      }
    });

    effect(() => {
      const bozza = this.bozza();
      const map = this.mappa();
      if (!map) {
        return;
      }
      if (!bozza?.centro) {
        this.cerchioBozza?.remove();
        this.cerchioBozza = null;
        return;
      }
      // Il cerchio deve stare tutto nella vista: si allarga la vista se esce dai bordi.
      const limiti = bozza.centro.toBounds(bozza.raggioMetri * 2);
      if (!map.getBounds().contains(limiti)) {
        map.fitBounds(limiti, { padding: [16, 16] });
      }
      if (!this.cerchioBozza) {
        this.cerchioBozza = circle(bozza.centro, {
          radius: bozza.raggioMetri,
          color: COLORE_BOZZA,
          weight: 2,
          dashArray: '6 4',
          fillOpacity: 0.15,
        }).addTo(map);
      } else {
        this.cerchioBozza.setLatLng(bozza.centro).setRadius(bozza.raggioMetri);
      }
    });
  }

  protected onMapReady(map: LeafletMap): void {
    ignoraIconeMancanti(this.sfondo);
    aggiungiLuoghiUtili(this.sfondo, () => this.stileSfondo === STILI_PER_TEMA.scuro);
    attribuzioneCompatta(map, this.transloco.translate('mappa.crediti'));
    map.on('click', (evento) => {
      impostaAttribuzioneAperta(map, false);
      const bozza = this.bozza();
      if (bozza) {
        this.bozza.set({ ...bozza, centro: evento.latlng });
      }
    });
    this.mappa.set(map);
  }

  private inquadra(map: LeafletMap, zone: ZonaNotifica[]): void {
    const limiti = latLngBounds(zone.map((z) => [z.lat, z.lng] as [number, number]));
    for (const z of zone) {
      limiti.extend(latLng(z.lat, z.lng).toBounds(z.raggioMetri * 2));
    }
    map.fitBounds(limiti, { padding: [24, 24], maxZoom: 15 });
  }

  protected nuova(): void {
    const map = this.mappa();
    this.erroreNome.set(false);
    this.bozza.set({
      id: null,
      nome: '',
      centro: map ? map.getCenter() : latLng(...CENTRO_PREDEFINITO),
      raggioMetri: RAGGIO_PREDEFINITO,
    });
  }

  protected modifica(zona: ZonaNotifica): void {
    this.erroreNome.set(false);
    const centro = latLng(zona.lat, zona.lng);
    this.bozza.set({ id: zona.id, nome: zona.nome, centro, raggioMetri: zona.raggioMetri });
  }

  protected annulla(): void {
    this.bozza.set(null);
  }

  protected aggiornaNome(nome: string): void {
    this.bozza.update((b) => (b ? { ...b, nome } : b));
    if (nome.trim()) {
      this.erroreNome.set(false);
    }
  }

  protected aggiornaRaggio(valore: string): void {
    this.bozza.update((b) => (b ? { ...b, raggioMetri: Number(valore) } : b));
  }

  /** Centro della zona sulla posizione attuale (chiede il permesso solo qui, su richiesta). */
  protected usaPosizione(): void {
    if (!navigator.geolocation) {
      this.erroreGps.set(true);
      return;
    }
    this.localizzando.set(true);
    this.erroreGps.set(false);
    navigator.geolocation.getCurrentPosition(
      (posizione) => {
        this.localizzando.set(false);
        const centro = latLng(posizione.coords.latitude, posizione.coords.longitude);
        this.bozza.update((b) => (b ? { ...b, centro } : b));
      },
      () => {
        this.localizzando.set(false);
        this.erroreGps.set(true);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  protected conferma(): void {
    const bozza = this.bozza();
    if (!bozza?.centro) {
      return;
    }
    if (!bozza.nome.trim()) {
      this.erroreNome.set(true);
      return;
    }
    this.salva.emit({
      id: bozza.id,
      zona: {
        nome: bozza.nome.trim(),
        lat: bozza.centro.lat,
        lng: bozza.centro.lng,
        raggioMetri: bozza.raggioMetri,
      },
    });
  }

  /** La pagina chiama questo dopo un salvataggio riuscito. */
  chiudiBozza(): void {
    this.bozza.set(null);
  }

  protected formattaRaggio(metri: number): string {
    return metri < 1000
      ? `${metri} m`
      : `${new Intl.NumberFormat(this.transloco.getActiveLang(), { maximumFractionDigits: 1 }).format(metri / 1000)} km`;
  }
}
