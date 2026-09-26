import { Component, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

export type VistaMappa = 'mappa' | 'lista';

/**
 * Barra delle azioni della pagina mappa. Mobile: piena larghezza in fondo, alta quanto
 * `--altezza-navbar-mappa` (vedi `.mappa-con-navbar` in styles.scss). Desktop: pillola
 * flottante centrata. Solo presentazionale: lo stato vive nella pagina mappa.
 */
@Component({
  selector: 'app-navbar-mappa',
  standalone: true,
  imports: [TranslocoDirective, LucideDynamicIcon],
  template: `
    <nav
      *transloco="let t"
      [attr.aria-label]="t('mappa.navbar.etichetta')"
      class="absolute inset-x-0 bottom-0 z-[1150] grid h-[var(--altezza-navbar-mappa)] grid-cols-3 items-start border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] text-neutral-600 sm:inset-x-auto sm:bottom-5 sm:left-1/2 sm:h-16 sm:w-[22rem] sm:-translate-x-1/2 sm:rounded-full sm:border sm:pb-0 sm:shadow-lg dark:border-line dark:bg-panel dark:text-muted"
    >
      <button type="button" class="voce-navbar-mappa" (click)="soccorsi.emit()">
        <svg lucideIcon="phone" class="h-5 w-5 text-allerta" aria-hidden="true"></svg>
        <span>{{ t('mappa.navbar.soccorsi') }}</span>
      </button>

      <button
        type="button"
        class="voce-navbar-mappa text-neutral-900 dark:text-paper"
        (click)="nuovaSegnalazione.emit()"
      >
        <span
          class="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-allerta text-white shadow-md ring-4 ring-white sm:-mt-4 dark:ring-panel"
          aria-hidden="true"
        >
          <svg lucideIcon="plus" class="h-6 w-6"></svg>
        </span>
        <span>{{ t('mappa.navbar.segnala') }}</span>
      </button>

      <button
        type="button"
        class="voce-navbar-mappa"
        [attr.aria-pressed]="vista() === 'lista'"
        (click)="cambiaVista.emit(vista() === 'mappa' ? 'lista' : 'mappa')"
      >
        <svg
          [lucideIcon]="vista() === 'mappa' ? 'list' : 'map'"
          class="h-5 w-5"
          aria-hidden="true"
        ></svg>
        <span>{{ t(vista() === 'mappa' ? 'mappa.navbar.lista' : 'mappa.navbar.mappa') }}</span>
      </button>
    </nav>
  `,
})
export class NavbarMappa {
  readonly vista = input.required<VistaMappa>();
  readonly nuovaSegnalazione = output<void>();
  readonly soccorsi = output<void>();
  readonly cambiaVista = output<VistaMappa>();
}
