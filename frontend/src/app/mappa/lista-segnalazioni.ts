import { Component, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { LatLng } from 'leaflet';
import { catchError, distinctUntilChanged, finalize, of, switchMap, tap } from 'rxjs';
import { SegnalazioneApi } from '../gestione/segnalazioni/segnalazione-api';
import { Segnalazione } from '../models/segnalazione.model';
import { NOME_ICONA_FALLBACK } from '../shared/icone-categoria';
import { formattaDistanza, formattaTempoFa } from './formattazione';

/** Raggio attorno all'utente. Punto d'aggancio del futuro filtro per raggio. */
const RAGGIO_LISTA_METRI = 2000;
/** Il GPS aggiorna di continuo: si ricarica solo se il centro si è spostato più di così. */
const SPOSTAMENTO_MINIMO_METRI = 100;

interface VoceLista {
  segnalazione: Segnalazione;
  metri: number;
}

/**
 * Vista a lista delle segnalazioni attorno all'utente, dalla più vicina. Carica i propri dati
 * attorno a `centro` (la posizione dell'utente), indipendentemente da dove si trova la mappa.
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

  protected get raggio(): string {
    return formattaDistanza(RAGGIO_LISTA_METRI, this.transloco.getActiveLang());
  }

  protected readonly caricamento = signal(true);
  protected readonly errore = signal(false);
  private readonly segnalazioni = signal<Segnalazione[]>([]);

  private readonly transloco = inject(TranslocoService);
  private readonly segnalazioneApi = inject(SegnalazioneApi);

  protected readonly voci = computed<VoceLista[]>(() => {
    const centro = this.centro();
    return this.segnalazioni()
      .map((segnalazione) => ({
        segnalazione,
        metri: centro.distanceTo([segnalazione.lat, segnalazione.lng]),
      }))
      .sort((a, b) => a.metri - b.metri);
  });

  constructor() {
    toObservable(this.centro)
      .pipe(
        distinctUntilChanged((prima, dopo) => prima.distanceTo(dopo) < SPOSTAMENTO_MINIMO_METRI),
        tap(() => {
          this.caricamento.set(true);
          this.errore.set(false);
        }),
        switchMap((centro) =>
          this.segnalazioneApi.vicine(centro.lat, centro.lng, RAGGIO_LISTA_METRI).pipe(
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
