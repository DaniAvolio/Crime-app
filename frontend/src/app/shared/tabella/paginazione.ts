import { Component, computed, input } from '@angular/core';
import { DIMENSIONI_PAGINA, Filtri, StatoTabella } from './tabella';

type VocePagina = number | 'salto';

/** Barra sotto le tabelle di gestione: "1–25 di 132", righe per pagina, numeri di pagina. */
@Component({
  selector: 'app-paginazione',
  standalone: true,
  template: `
    <nav
      class="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600 dark:text-muted"
      aria-label="Paginazione"
    >
      <div class="flex items-center gap-3">
        <span class="tabular-nums" aria-live="polite">
          @if (totale() === 0) {
            0 risultati
          } @else {
            {{ primo() }}–{{ ultimo() }} di {{ totale() }}
          }
        </span>
        <label class="flex items-center gap-1.5">
          <span>Righe</span>
          <select
            class="filtro-tabella w-auto py-1"
            (change)="tabella().cambiaDimensione(+$any($event.target).value)"
          >
            @for (dimensione of dimensioni; track dimensione) {
              <option [value]="dimensione" [selected]="dimensione === tabella().dimensione()">
                {{ dimensione }}
              </option>
            }
          </select>
        </label>
      </div>

      @if (totalePagine() > 1) {
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="pulsante-pagina"
            [disabled]="pagina() === 0"
            (click)="tabella().vaiAPagina(pagina() - 1)"
            aria-label="Pagina precedente"
          >
            ‹
          </button>
          @for (voce of voci(); track $index) {
            @if (voce === 'salto') {
              <span class="px-1" aria-hidden="true">…</span>
            } @else {
              <button
                type="button"
                class="pulsante-pagina tabular-nums"
                [class.pulsante-pagina--attivo]="voce === pagina()"
                [attr.aria-current]="voce === pagina() ? 'page' : null"
                (click)="tabella().vaiAPagina(voce)"
              >
                {{ voce + 1 }}
              </button>
            }
          }
          <button
            type="button"
            class="pulsante-pagina"
            [disabled]="pagina() >= totalePagine() - 1"
            (click)="tabella().vaiAPagina(pagina() + 1)"
            aria-label="Pagina successiva"
          >
            ›
          </button>
        </div>
      }
    </nav>
  `,
})
export class Paginazione {
  readonly tabella = input.required<StatoTabella<Filtri, unknown>>();

  protected readonly dimensioni = DIMENSIONI_PAGINA;
  protected readonly pagina = computed(() => this.tabella().pagina());
  protected readonly totale = computed(() => this.tabella().totale());
  protected readonly totalePagine = computed(() =>
    Math.ceil(this.totale() / this.tabella().dimensione()),
  );
  protected readonly primo = computed(() => this.pagina() * this.tabella().dimensione() + 1);
  protected readonly ultimo = computed(() =>
    Math.min(this.totale(), (this.pagina() + 1) * this.tabella().dimensione()),
  );

  /** Prima, ultima e le due vicine alla corrente; i buchi diventano "…". */
  protected readonly voci = computed<VocePagina[]>(() => {
    const totale = this.totalePagine();
    const corrente = this.pagina();
    const voci: VocePagina[] = [];
    for (let i = 0; i < totale; i++) {
      if (i === 0 || i === totale - 1 || Math.abs(i - corrente) <= 1) {
        voci.push(i);
      } else if (voci.at(-1) !== 'salto') {
        voci.push('salto');
      }
    }
    return voci;
  });
}
