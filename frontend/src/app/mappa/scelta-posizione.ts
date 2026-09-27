import { Component, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

/**
 * Primo passo della nuova segnalazione: la mappa resta quasi a tutto schermo con il pin fisso
 * al centro, e questa card compatta offre solo le azioni per confermare il punto.
 */
@Component({
  selector: 'app-scelta-posizione',
  standalone: true,
  imports: [TranslocoDirective, LucideDynamicIcon],
  template: `
    <section
      *transloco="let t"
      class="pannello-mappa pt-4"
      aria-labelledby="titolo-scelta-posizione"
    >
      <header class="flex items-start gap-3">
        <div class="flex-1">
          <h2 id="titolo-scelta-posizione" class="font-display text-lg font-semibold leading-tight">
            {{ t('mappa.nuova.posizione.titolo') }}
          </h2>
          <p class="mt-1 text-sm text-neutral-500 dark:text-muted">
            {{ t('mappa.nuova.posizione.istruzione') }}
          </p>
        </div>
        <button
          type="button"
          class="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-muted dark:hover:bg-ink"
          [attr.aria-label]="t('mappa.nuova.annulla')"
          (click)="chiudi.emit()"
        >
          <svg lucideIcon="x" class="h-5 w-5" aria-hidden="true"></svg>
        </button>
      </header>

      <div class="mt-4 flex gap-2">
        @if (posizioneUtenteNota()) {
          <button
            type="button"
            class="flex h-11 items-center justify-center gap-1.5 rounded-md border border-neutral-300 px-4 font-medium text-blue-600 transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-line dark:text-paper dark:hover:bg-ink"
            (click)="miaPosizione.emit()"
          >
            <svg lucideIcon="locate-fixed" class="h-4 w-4" aria-hidden="true"></svg>
            {{ t('mappa.nuova.miaPosizione') }}
          </button>
        }
        <button
          type="button"
          class="h-11 flex-1 rounded-md bg-allerta font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          (click)="continua.emit()"
        >
          {{ t('mappa.nuova.posizione.continua') }}
        </button>
      </div>
    </section>
  `,
})
export class SceltaPosizione {
  readonly posizioneUtenteNota = input(false);
  readonly continua = output<void>();
  readonly miaPosizione = output<void>();
  readonly chiudi = output<void>();
}
