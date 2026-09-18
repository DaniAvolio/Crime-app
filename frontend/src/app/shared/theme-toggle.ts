import { Component, inject } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TemaService } from './tema';

/**
 * Pulsante per alternare tema chiaro/scuro, pensato per essere riusato in ogni pagina
 * (attuale o futura): incapsula TemaService, cosi le pagine non devono duplicare logica.
 */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [LucideDynamicIcon],
  template: `
    <button
      type="button"
      (click)="tema.alterna()"
      [attr.aria-label]="
        tema.temaAttuale() === 'scuro' ? 'Attiva il tema chiaro' : 'Attiva il tema scuro'
      "
      class="flex h-8 w-8 items-center justify-center rounded-sm text-current transition-colors hover:bg-black/5 dark:hover:bg-white/10"
    >
      <svg [lucideIcon]="tema.temaAttuale() === 'scuro' ? 'sun' : 'moon'" class="h-4 w-4"></svg>
    </button>
  `,
})
export class ThemeToggle {
  protected readonly tema = inject(TemaService);
}
