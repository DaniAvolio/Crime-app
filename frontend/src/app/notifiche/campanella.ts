import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwPush } from '@angular/service-worker';
import { AuthService } from '../auth/auth';
import { NotificheApi } from './notifiche-api';

/** Ogni quanto si ricontrolla il numero di avvisi non letti, a scheda visibile. */
const INTERVALLO_MS = 60_000;

/**
 * Numero di avvisi non letti per il badge della campanella in Nav. Si aggiorna all'accesso,
 * ogni minuto mentre la scheda è visibile, al ritorno sulla scheda e subito all'arrivo di una
 * push (se il service worker è attivo). Le pagine che segnano avvisi come letti chiamano aggiorna().
 */
@Injectable({ providedIn: 'root' })
export class CampanellaService {
  private readonly api = inject(NotificheApi);
  private readonly auth = inject(AuthService);

  readonly nonLette = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    const swPush = inject(SwPush);
    if (swPush.isEnabled) {
      swPush.messages.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.aggiorna());
    }
    const visibilita = () => {
      if (document.visibilityState === 'visible') {
        this.aggiorna();
      }
    };
    document.addEventListener('visibilitychange', visibilita);
    destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', visibilita);
      this.fermaTimer();
    });

    effect(() => {
      this.fermaTimer();
      if (!this.auth.autenticato()) {
        this.nonLette.set(0);
        return;
      }
      this.aggiorna();
      this.timer = setInterval(() => {
        if (document.visibilityState === 'visible') {
          this.aggiorna();
        }
      }, INTERVALLO_MS);
    });
  }

  aggiorna(): void {
    if (!this.auth.autenticato()) {
      return;
    }
    this.api.nonLette().subscribe({ next: (n) => this.nonLette.set(n), error: () => undefined });
  }

  private fermaTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
