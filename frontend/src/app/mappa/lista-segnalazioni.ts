import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { LatLng } from 'leaflet';
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  finalize,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { SegnalazioneApi } from '../gestione/segnalazioni/segnalazione-api';
import { Segnalazione } from '../models/segnalazione.model';
import { NOME_ICONA_FALLBACK } from '../shared/icone-categoria';
import { formattaDistanza, formattaTempoFa } from './formattazione';

/** Raggi selezionabili attorno all'utente. */
const RAGGI_METRI = [500, 1000, 2000, 5000, 10000] as const;
const RAGGIO_PREDEFINITO_METRI = 2000;
/** Il raggio scelto si ricorda tra una visita e l'altra (solo comodità: se manca, si usa il default). */
const CHIAVE_RAGGIO = 'crime-lista-raggio';
/** Il GPS aggiorna di continuo: si ricarica solo se il centro si è spostato più di così. */
const SPOSTAMENTO_MINIMO_METRI = 100;

interface VoceLista {
  segnalazione: Segnalazione;
  metri: number;
}

interface CategoriaConConteggio {
  id: number;
  nome: string;
  numero: number;
}

function leggiRaggioSalvato(): number {
  try {
    const salvato = Number(localStorage.getItem(CHIAVE_RAGGIO));
    return (RAGGI_METRI as readonly number[]).includes(salvato)
      ? salvato
      : RAGGIO_PREDEFINITO_METRI;
  } catch {
    return RAGGIO_PREDEFINITO_METRI;
  }
}

/**
 * Vista a lista delle segnalazioni attorno all'utente, dalla più vicina. Carica i propri dati
 * attorno a `centro` (la posizione dell'utente), indipendentemente da dove si trova la mappa,
 * entro il raggio scelto; il filtro per categoria lavora sui risultati già caricati.
 */
@Component({
  selector: 'app-lista-segnalazioni',
  standalone: true,
  imports: [TranslocoDirective, LucideDynamicIcon],
  templateUrl: './lista-segnalazioni.html',
})
export class ListaSegnalazioni {
  /** Posizione dell'utente; se non disponibile, il centro della mappa all'apertura della lista. */
  readonly centro = input.required<LatLng>();
  readonly centroUtente = input(false);
  readonly iconePerCategoria = input.required<Map<number, string>>();

  readonly seleziona = output<Segnalazione>();

  protected readonly raggi = RAGGI_METRI;
  protected readonly raggioMetri = signal(leggiRaggioSalvato());
  /** Categoria selezionata nelle chip; null = tutte. */
  protected readonly categoriaFiltro = signal<number | null>(null);
  protected readonly caricamento = signal(true);
  protected readonly errore = signal(false);
  private readonly segnalazioni = signal<Segnalazione[]>([]);

  private readonly transloco = inject(TranslocoService);
  private readonly segnalazioneApi = inject(SegnalazioneApi);

  /** Tutte le segnalazioni caricate, con la distanza, dalla più vicina. */
  private readonly tutteLeVoci = computed<VoceLista[]>(() => {
    const centro = this.centro();
    return this.segnalazioni()
      .map((segnalazione) => ({
        segnalazione,
        metri: centro.distanceTo([segnalazione.lat, segnalazione.lng]),
      }))
      .sort((a, b) => a.metri - b.metri);
  });

  protected readonly voci = computed(() => {
    const categoria = this.categoriaFiltro();
    const voci = this.tutteLeVoci();
    return categoria === null ? voci : voci.filter((v) => v.segnalazione.categoriaId === categoria);
  });

  /** Chip delle categorie: solo quelle presenti nei risultati, con quante segnalazioni hanno. */
  protected readonly categorie = computed<CategoriaConConteggio[]>(() => {
    const perId = new Map<number, CategoriaConConteggio>();
    for (const { categoriaId, categoriaNome } of this.segnalazioni()) {
      const voce = perId.get(categoriaId) ?? { id: categoriaId, nome: categoriaNome, numero: 0 };
      voce.numero++;
      perId.set(categoriaId, voce);
    }
    return [...perId.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  });

  protected readonly totale = computed(() => this.segnalazioni().length);

  protected readonly nomeCategoriaFiltro = computed(
    () => this.categorie().find((c) => c.id === this.categoriaFiltro())?.nome ?? null,
  );

  /** Raggio successivo a quello scelto, proposto quando non ci sono risultati. */
  protected readonly raggioSuccessivo = computed(
    () => RAGGI_METRI.find((r) => r > this.raggioMetri()) ?? null,
  );

  constructor() {
    const centro$ = toObservable(this.centro).pipe(
      distinctUntilChanged((prima, dopo) => prima.distanceTo(dopo) < SPOSTAMENTO_MINIMO_METRI),
    );
    combineLatest([centro$, toObservable(this.raggioMetri)])
      .pipe(
        tap(() => {
          this.caricamento.set(true);
          this.errore.set(false);
        }),
        switchMap(([centro, raggio]) =>
          this.segnalazioneApi.vicine(centro.lat, centro.lng, raggio).pipe(
            catchError(() => {
              this.errore.set(true);
              return of(null);
            }),
            finalize(() => this.caricamento.set(false)),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((segnalazioni) => {
        if (segnalazioni) {
          this.segnalazioni.set(segnalazioni);
        }
      });

    // Se la categoria scelta non ha più segnalazioni (es. raggio ridotto) si torna a "Tutte".
    effect(() => {
      const categoria = this.categoriaFiltro();
      if (
        categoria !== null &&
        !this.caricamento() &&
        !this.categorie().some((c) => c.id === categoria)
      ) {
        this.categoriaFiltro.set(null);
      }
    });
  }

  protected scegliRaggio(raggio: number): void {
    this.raggioMetri.set(raggio);
    try {
      localStorage.setItem(CHIAVE_RAGGIO, String(raggio));
    } catch {
      // Storage non disponibile (es. navigazione privata): la scelta vale solo per questa visita.
    }
  }

  /** Frecce ←/→ tra i raggi, come in un gruppo di radio button. */
  protected muoviRaggio(evento: KeyboardEvent): void {
    const passo = evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowLeft' ? -1 : 0;
    if (passo === 0) {
      return;
    }
    evento.preventDefault();
    const indice = RAGGI_METRI.indexOf(this.raggioMetri() as (typeof RAGGI_METRI)[number]);
    const nuovo = RAGGI_METRI[Math.min(RAGGI_METRI.length - 1, Math.max(0, indice + passo))];
    this.scegliRaggio(nuovo);
    const gruppo = evento.currentTarget as HTMLElement;
    queueMicrotask(() => gruppo.querySelector<HTMLElement>(`[data-raggio="${nuovo}"]`)?.focus());
  }

  protected scegliCategoria(id: number | null): void {
    this.categoriaFiltro.set(this.categoriaFiltro() === id ? null : id);
  }

  protected distanza(metri: number): string {
    return formattaDistanza(metri, this.transloco.getActiveLang());
  }

  protected tempoFa(iso: string): string {
    return formattaTempoFa(iso, this.transloco.getActiveLang());
  }

  protected icona(categoriaId: number): string {
    return this.iconePerCategoria().get(categoriaId) ?? NOME_ICONA_FALLBACK;
  }
}
