import { NgClass } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { Filtri, StatoTabella } from './tabella';

/**
 * Intestazione di colonna ordinabile: `<th appOrdinabile="nome" [tabella]="tabella">Nome</th>`.
 * Il clic ordina per quel campo (poi alterna crescente/decrescente); `aria-sort` sul `th`
 * annuncia l'ordinamento attivo agli screen reader.
 */
@Component({
  selector: 'th[appOrdinabile]',
  standalone: true,
  imports: [NgClass],
  host: {
    '[attr.aria-sort]': 'ariaSort()',
    class: 'py-2 pr-3 font-medium',
  },
  template: `
    <button
      type="button"
      class="group inline-flex items-center gap-1 rounded-sm text-left whitespace-nowrap hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:text-paper"
      [ngClass]="{ 'text-gray-900 dark:text-paper': direzione() !== null }"
      (click)="tabella().ordina(appOrdinabile())"
    >
      <ng-content />
      <svg
        viewBox="0 0 24 24"
        class="h-3.5 w-3.5 shrink-0"
        [ngClass]="{ 'opacity-30 group-hover:opacity-70': direzione() === null }"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        @switch (direzione()) {
          @case ('asc') {
            <path d="m18 15-6-6-6 6" />
          }
          @case ('desc') {
            <path d="m6 9 6 6 6-6" />
          }
          @default {
            <path d="m7 15 5 5 5-5" />
            <path d="m7 9 5-5 5 5" />
          }
        }
      </svg>
    </button>
  `,
})
export class IntestazioneOrdinabile {
  readonly appOrdinabile = input.required<string>();
  readonly tabella = input.required<StatoTabella<Filtri, unknown>>();

  protected readonly direzione = computed(() => {
    const { campo, direzione } = this.tabella().ordinamento();
    return campo === this.appOrdinabile() ? direzione : null;
  });

  protected readonly ariaSort = computed(() => {
    const direzione = this.direzione();
    return direzione === null ? null : direzione === 'asc' ? 'ascending' : 'descending';
  });
}
