import { HttpErrorResponse, HttpParams } from '@angular/common/http';
import { DestroyRef, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, catchError, debounceTime, skip, switchMap, tap } from 'rxjs';
import { Pagina } from '../../models/pagina.model';

export type Direzione = 'asc' | 'desc';

export interface Ordinamento {
  campo: string;
  direzione: Direzione;
}

/** Filtri come li scrivono i campi della riga filtri: stringa vuota = filtro non applicato. */
export type Filtri = Record<string, string>;

export const DIMENSIONI_PAGINA = [10, 25, 50] as const;
const DIMENSIONE_PREDEFINITA = 25;
const ATTESA_FILTRI_MS = 300;

/**
 * Stato comune a ogni tabella di gestione, letto da `th[appOrdinabile]` e `<app-paginazione>`.
 */
export abstract class StatoTabella<F extends Filtri, T> {
  readonly ordinamento: WritableSignal<Ordinamento>;
  readonly filtri: WritableSignal<F>;
  readonly pagina = signal(0);
  readonly dimensione = signal(DIMENSIONE_PREDEFINITA);
  abstract readonly righe: Signal<T[]>;
  abstract readonly totale: Signal<number>;

  /** Filtri o ordinamento diversi da quelli di partenza: mostra "Azzera". */
  readonly modificata = computed(
    () =>
      Object.values(this.filtri()).some((valore) => valore !== '') ||
      this.ordinamento().campo !== this.ordinamentoPredefinito.campo ||
      this.ordinamento().direzione !== this.ordinamentoPredefinito.direzione,
  );

  protected constructor(
    private readonly filtriIniziali: F,
    private readonly ordinamentoPredefinito: Ordinamento,
  ) {
    this.filtri = signal(filtriIniziali);
    this.ordinamento = signal(ordinamentoPredefinito);
  }

  filtra(campo: keyof F & string, valore: string): void {
    this.filtri.update((filtri) => ({ ...filtri, [campo]: valore.trim() }));
    this.pagina.set(0);
  }

  /** Clic su una colonna: prima crescente, poi alterna crescente/decrescente. */
  ordina(campo: string): void {
    const attuale = this.ordinamento();
    this.ordinamento.set({
      campo,
      direzione: attuale.campo === campo && attuale.direzione === 'asc' ? 'desc' : 'asc',
    });
    this.pagina.set(0);
  }

  vaiAPagina(pagina: number): void {
    this.pagina.set(pagina);
  }

  cambiaDimensione(dimensione: number): void {
    this.dimensione.set(dimensione);
    this.pagina.set(0);
  }

  azzera(): void {
    this.filtri.set(this.filtriIniziali);
    this.ordinamento.set(this.ordinamentoPredefinito);
    this.pagina.set(0);
  }
}

export interface RichiestaPagina<F extends Filtri> {
  filtri: F;
  pagina: number;
  dimensione: number;
  ordinamento: Ordinamento;
}

/**
 * Tabella paginata, filtrata e ordinata dal backend. Va creata in un contesto di injection
 * (campo di un componente). I filtri partono dopo una breve pausa di digitazione; una nuova
 * richiesta annulla quella ancora in corso.
 */
export class TabellaRemota<F extends Filtri, T> extends StatoTabella<F, T> {
  private readonly pagine = signal<Pagina<T> | null>(null);
  readonly righe = computed(() => this.pagine()?.contenuto ?? []);
  readonly totale = computed(() => this.pagine()?.totaleElementi ?? 0);
  readonly caricando = signal(true);
  readonly errore = signal<HttpErrorResponse | null>(null);

  private readonly filtriApplicati: WritableSignal<F>;
  private readonly versione = signal(0);

  /** Richiesta in corso o filtri appena scritti in attesa di partire: mostra lo spinner. */
  readonly occupata = computed(() => this.caricando() || this.filtri() !== this.filtriApplicati());

  constructor(
    carica: (richiesta: RichiestaPagina<F>) => Observable<Pagina<T>>,
    filtriIniziali: F,
    ordinamentoPredefinito: Ordinamento,
  ) {
    super(filtriIniziali, ordinamentoPredefinito);
    this.filtriApplicati = signal(filtriIniziali);
    const distruzione = inject(DestroyRef);

    toObservable(this.filtri)
      .pipe(skip(1), debounceTime(ATTESA_FILTRI_MS), takeUntilDestroyed(distruzione))
      .subscribe((filtri) => {
        this.filtriApplicati.set(filtri);
        this.pagina.set(0);
      });

    const richiesta = computed(() => {
      this.versione();
      return {
        filtri: this.filtriApplicati(),
        pagina: this.pagina(),
        dimensione: this.dimensione(),
        ordinamento: this.ordinamento(),
      };
    });

    toObservable(richiesta)
      .pipe(
        tap(() => {
          this.caricando.set(true);
          this.errore.set(null);
        }),
        switchMap((r) =>
          carica(r).pipe(
            catchError((err: HttpErrorResponse) => {
              this.errore.set(err);
              this.caricando.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(distruzione),
      )
      .subscribe((pagina) => {
        // Pagina rimasta vuota (es. eliminata l'ultima riga): si torna all'ultima esistente.
        if (pagina.contenuto.length === 0 && pagina.pagina > 0) {
          this.pagina.set(Math.max(0, pagina.totalePagine - 1));
          return;
        }
        this.pagine.set(pagina);
        this.caricando.set(false);
      });
  }

  /** La pagina torna alla prima quando i filtri vengono applicati, dopo la pausa di digitazione. */
  override filtra(campo: keyof F & string, valore: string): void {
    this.filtri.update((filtri) => ({ ...filtri, [campo]: valore.trim() }));
  }

  /** Ricarica la pagina corrente, ad esempio dopo una modifica o un'eliminazione. */
  aggiorna(): void {
    this.versione.update((n) => n + 1);
  }
}

/** Query string per gli endpoint `/gestione`: solo i filtri valorizzati, più pagina e ordinamento. */
export function parametriPagina<F extends Filtri>(richiesta: RichiestaPagina<F>): HttpParams {
  let params = new HttpParams()
    .set('pagina', richiesta.pagina)
    .set('dimensione', richiesta.dimensione)
    .set('ordina', `${richiesta.ordinamento.campo},${richiesta.ordinamento.direzione}`);
  for (const [nome, valore] of Object.entries(richiesta.filtri)) {
    if (valore !== '') {
      params = params.set(nome, valore);
    }
  }
  return params;
}
