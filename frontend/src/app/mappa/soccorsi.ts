import { Component, ElementRef, afterNextRender, output, viewChild } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

/**
 * Conferma prima di chiamare il 112: un tocco accidentale sul tasto Soccorsi non deve far
 * partire una chiamata d'emergenza. Il link `tel:` apre il telefono; da desktop, dove spesso
 * non si può chiamare, resta visibile il numero.
 */
@Component({
  selector: 'app-soccorsi',
  standalone: true,
  imports: [TranslocoDirective, LucideDynamicIcon],
  host: { '(document:keydown.escape)': 'chiudi.emit()' },
  template: `
    <div
      *transloco="let t"
      class="absolute inset-0 z-[1200] flex items-end justify-center bg-black/40 sm:items-center"
      (click)="chiudi.emit()"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titolo-soccorsi"
        aria-describedby="testo-soccorsi"
        class="w-full rounded-t-2xl bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 text-neutral-900 shadow-xl sm:w-96 sm:rounded-xl sm:pb-5 dark:bg-panel dark:text-paper"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-start gap-3">
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-allerta text-white"
            aria-hidden="true"
          >
            <svg lucideIcon="phone" class="h-5 w-5"></svg>
          </span>
          <div>
            <h2 id="titolo-soccorsi" class="font-display text-lg font-semibold leading-tight">
              {{ t('mappa.soccorsi.titolo') }}
            </h2>
            <p
              id="testo-soccorsi"
              class="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-muted"
            >
              {{ t('mappa.soccorsi.testo') }}
            </p>
          </div>
        </div>

        <div class="mt-5 flex flex-col gap-2">
          <a
            #chiama
            href="tel:112"
            class="flex h-12 items-center justify-center gap-2 rounded-md bg-allerta font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <svg lucideIcon="phone" class="h-5 w-5" aria-hidden="true"></svg>
            {{ t('mappa.soccorsi.chiama') }}
          </a>
          <button
            type="button"
            class="h-11 rounded-md border border-neutral-300 font-medium transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-line dark:hover:bg-ink"
            (click)="chiudi.emit()"
          >
            {{ t('mappa.soccorsi.annulla') }}
          </button>
        </div>
        <p class="mt-3 hidden text-center text-sm text-neutral-500 sm:block dark:text-muted">
          {{ t('mappa.soccorsi.daComputer') }}
        </p>
      </div>
    </div>
  `,
})
export class Soccorsi {
  readonly chiudi = output<void>();

  private readonly chiama = viewChild<ElementRef<HTMLAnchorElement>>('chiama');

  constructor() {
    afterNextRender(() => this.chiama()?.nativeElement.focus());
  }
}
