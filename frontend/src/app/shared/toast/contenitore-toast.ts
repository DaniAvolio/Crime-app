import { Component, DestroyRef, effect, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { TipoToast, ToastService } from './toast';

interface TimerToast {
  timeout: ReturnType<typeof setTimeout> | null;
  rimanente: number;
  avviato: number;
}

const ICONE: Record<TipoToast, string> = {
  successo: 'check',
  errore: 'triangle-alert',
  info: 'info',
};

/**
 * Pila dei toast, montata una volta in app.html. In alto (sotto l'header) per non coprire la
 * navbar e i pannelli in basso della mappa. I timer si sospendono finché il puntatore o il
 * focus sono sulla pila, così un messaggio non sparisce mentre lo si sta leggendo.
 */
@Component({
  selector: 'app-contenitore-toast',
  standalone: true,
  imports: [TranslocoDirective, LucideDynamicIcon],
  template: `
    <div
      *transloco="let t"
      class="pointer-events-none fixed inset-x-4 top-20 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end"
      (mouseenter)="sospendi()"
      (mouseleave)="riprendi()"
      (focusin)="sospendi()"
      (focusout)="riprendi()"
    >
      @for (toast of toastService.toast(); track toast.id) {
        <div
          [attr.role]="toast.tipo === 'errore' ? 'alert' : 'status'"
          [attr.aria-live]="toast.tipo === 'errore' ? 'assertive' : 'polite'"
          class="toast-entra pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 shadow-lg dark:border-line dark:bg-panel dark:text-paper"
        >
          <span
            class="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
            [class.bg-emerald-600]="toast.tipo === 'successo'"
            [class.bg-allerta]="toast.tipo === 'errore'"
            [class.bg-blue-600]="toast.tipo === 'info'"
            aria-hidden="true"
          >
            <svg [lucideIcon]="icone[toast.tipo]" class="h-3.5 w-3.5"></svg>
          </span>
          <p class="flex-1 leading-relaxed">{{ toast.messaggio }}</p>
          @if (toast.azione; as azione) {
            <button
              type="button"
              class="shrink-0 font-semibold text-allerta underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-red-400"
              (click)="azione.esegui(); toastService.chiudi(toast.id)"
            >
              {{ azione.etichetta }}
            </button>
          }
          <button
            type="button"
            class="-mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-muted dark:hover:bg-ink"
            [attr.aria-label]="t('condivisi.toast.chiudi')"
            (click)="toastService.chiudi(toast.id)"
          >
            <svg lucideIcon="x" class="h-4 w-4" aria-hidden="true"></svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class ContenitoreToast {
  protected readonly toastService = inject(ToastService);
  protected readonly icone = ICONE;

  private readonly timer = new Map<number, TimerToast>();
  private sospeso = false;

  constructor() {
    // Avvia un timer per ogni toast nuovo e dimentica quelli chiusi.
    effect(() => {
      const presenti = new Set(this.toastService.toast().map((t) => t.id));
      for (const toast of this.toastService.toast()) {
        if (!this.timer.has(toast.id)) {
          this.timer.set(toast.id, { timeout: null, rimanente: toast.durata, avviato: 0 });
          if (!this.sospeso) {
            this.avvia(toast.id);
          }
        }
      }
      for (const [id, timer] of this.timer) {
        if (!presenti.has(id)) {
          if (timer.timeout) {
            clearTimeout(timer.timeout);
          }
          this.timer.delete(id);
        }
      }
    });
    inject(DestroyRef).onDestroy(() =>
      this.timer.forEach((t) => t.timeout && clearTimeout(t.timeout)),
    );
  }

  protected sospendi(): void {
    this.sospeso = true;
    for (const timer of this.timer.values()) {
      if (timer.timeout) {
        clearTimeout(timer.timeout);
        timer.timeout = null;
        timer.rimanente -= Date.now() - timer.avviato;
      }
    }
  }

  protected riprendi(): void {
    this.sospeso = false;
    for (const id of this.timer.keys()) {
      this.avvia(id);
    }
  }

  private avvia(id: number): void {
    const timer = this.timer.get(id);
    if (!timer || timer.timeout) {
      return;
    }
    timer.avviato = Date.now();
    timer.timeout = setTimeout(() => this.toastService.chiudi(id), Math.max(0, timer.rimanente));
  }
}
