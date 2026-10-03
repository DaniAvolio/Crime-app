import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth';
import { LoggerService } from '../shared/logger';
import { NotificheApi } from './notifiche-api';

/**
 * Stato delle notifiche push su questo dispositivo:
 * - nonSupportato: niente service worker o Push API (es. `ng serve`, browser vecchi);
 * - daInstallare: iPhone/iPad, dove le push arrivano solo all'app aggiunta alla schermata Home;
 * - bloccato: l'utente ha negato il permesso, si riattiva solo dalle impostazioni del browser;
 * - spento / attivo.
 */
export type StatoPush = 'nonSupportato' | 'daInstallare' | 'bloccato' | 'spento' | 'attivo';

function ios(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function installata(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Sottoscrizione Web Push del dispositivo, tramite il service worker di Angular (SwPush).
 * La sottoscrizione appartiene all'utente con cui è stata fatta: al logout si annulla, così
 * su un dispositivo condiviso non arrivano più gli avvisi dell'account precedente.
 */
@Injectable({ providedIn: 'root' })
export class PushDispositivoService {
  private readonly swPush = inject(SwPush);
  private readonly api = inject(NotificheApi);
  private readonly auth = inject(AuthService);
  private readonly transloco = inject(TranslocoService);
  private readonly logger = inject(LoggerService);

  private readonly sottoscrizione = signal<PushSubscription | null>(null);
  private readonly permesso = signal<NotificationPermission>(
    typeof Notification === 'undefined' ? 'denied' : Notification.permission,
  );
  readonly occupato = signal(false);

  readonly stato = computed<StatoPush>(() => {
    if (ios() && !installata()) {
      return 'daInstallare';
    }
    if (!this.swPush.isEnabled || typeof Notification === 'undefined') {
      return 'nonSupportato';
    }
    if (this.permesso() === 'denied') {
      return 'bloccato';
    }
    return this.sottoscrizione() ? 'attivo' : 'spento';
  });

  constructor() {
    if (this.swPush.isEnabled) {
      this.swPush.subscription.subscribe((s) => this.sottoscrizione.set(s));
    }
    // Logout (anche per sessione scaduta): la sottoscrizione del browser si annulla; il backend
    // la cancella al primo invio fallito (410).
    effect(() => {
      if (!this.auth.autenticato()) {
        untracked(() => {
          if (this.sottoscrizione()) {
            this.swPush.unsubscribe().catch(() => undefined);
          }
        });
      }
    });
  }

  /** Chiede il permesso, crea la sottoscrizione con la chiave VAPID del server e la registra. */
  async attiva(): Promise<boolean> {
    if (this.stato() !== 'spento' || this.occupato()) {
      return this.stato() === 'attivo';
    }
    this.occupato.set(true);
    try {
      const { chiave } = await firstValueFrom(this.api.chiavePubblica());
      const sottoscrizione = await this.swPush.requestSubscription({ serverPublicKey: chiave });
      await firstValueFrom(this.api.sottoscrivi(this.payload(sottoscrizione)));
      return true;
    } catch (errore) {
      this.logger.warn('Attivazione push non riuscita', errore);
      return false;
    } finally {
      this.permesso.set(Notification.permission);
      this.occupato.set(false);
    }
  }

  async disattiva(): Promise<void> {
    const sottoscrizione = this.sottoscrizione();
    if (!sottoscrizione || this.occupato()) {
      return;
    }
    this.occupato.set(true);
    try {
      await firstValueFrom(this.api.disiscrivi(sottoscrizione.endpoint)).catch(() => undefined);
      await this.swPush.unsubscribe();
    } finally {
      this.occupato.set(false);
    }
  }

  /** Riallinea il backend (es. lingua cambiata, chiavi ruotate dal browser). */
  aggiornaSeAttiva(): void {
    const sottoscrizione = this.sottoscrizione();
    if (sottoscrizione && this.auth.autenticato()) {
      this.api.sottoscrivi(this.payload(sottoscrizione)).subscribe({ error: () => undefined });
    }
  }

  private payload(sottoscrizione: PushSubscription) {
    const json = sottoscrizione.toJSON();
    return {
      endpoint: sottoscrizione.endpoint,
      p256dh: json.keys?.['p256dh'] ?? '',
      auth: json.keys?.['auth'] ?? '',
      lingua: this.transloco.getActiveLang(),
    };
  }
}
