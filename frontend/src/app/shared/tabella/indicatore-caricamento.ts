import { Component, input } from '@angular/core';

/**
 * Spinner accanto al titolo delle tabelle di gestione. Compare con un piccolo ritardo
 * (`.spinner-ritardato`) così le risposte immediate non lo fanno lampeggiare.
 */
@Component({
  selector: 'app-indicatore-caricamento',
  standalone: true,
  template: `
    @if (attivo()) {
      <span
        class="spinner-ritardato inline-flex items-center gap-1.5 text-xs font-normal text-gray-500 dark:text-muted"
        role="status"
      >
        <svg
          class="h-4 w-4 animate-spin text-allerta"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" class="opacity-25" />
          <path
            d="M21 12a9 9 0 0 0-9-9"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
          />
        </svg>
        Caricamento…
      </span>
    }
  `,
})
export class IndicatoreCaricamento {
  readonly attivo = input(false);
}
