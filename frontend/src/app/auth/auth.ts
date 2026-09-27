import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Utente } from '../models/utente.model';
import { LoggerService } from '../shared/logger';
import { AuthApi, AuthResponse, LoginRequest, RegistrazioneRequest } from './auth-api';

const CHIAVE_STORAGE = 'crime-app-sessione';

interface Sessione {
  token: string;
  utente: Utente;
}

/**
 * Stato globale di autenticazione. Il JWT (vedi SecurityConfig lato backend) viene
 * salvato in localStorage insieme all'utente, così un reload non fa perdere la
 * sessione; all'avvio un token già scaduto viene scartato senza chiamare il backend.
 * Il token viene aggiunto alle chiamate API da authInterceptor.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApi);
  private readonly log = inject(LoggerService);

  private readonly sessione = signal<Sessione | null>(this.leggiSessioneSalvata());

  readonly utente = computed(() => this.sessione()?.utente ?? null);
  readonly token = computed(() => this.sessione()?.token ?? null);
  readonly autenticato = computed(() => this.sessione() !== null);
  readonly isAdmin = computed(() => this.utente()?.ruolo === 'ADMIN');

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.api.login(payload).pipe(tap((risposta) => this.salva(risposta)));
  }

  registrazione(payload: RegistrazioneRequest): Observable<AuthResponse> {
    return this.api.registrazione(payload).pipe(tap((risposta) => this.salva(risposta)));
  }

  /**
   * Riallinea l'utente salvato con il backend (es. ruolo cambiato da un admin dopo il
   * login). Un 401 qui significa sessione non più valida: ci pensa authInterceptor.
   * Va chiamato dopo l'avvio (vedi Nav), non nel costruttore: HttpClient passa da
   * authInterceptor, che a sua volta inietta questo servizio.
   */
  aggiornaUtente(): void {
    const token = this.token();
    if (!token) {
      return;
    }
    this.api.me().subscribe({
      next: (utente) => this.salva({ token, utente }),
      error: () => {
        // Errori di rete: si tiene la sessione salvata, il 401 lo gestisce l'interceptor.
      },
    });
  }

  logout(): void {
    this.sessione.set(null);
    try {
      localStorage.removeItem(CHIAVE_STORAGE);
    } catch {
      // Storage non disponibile: basta aver svuotato lo stato in memoria.
    }
  }

  private salva({ token, utente }: Sessione): void {
    const sessione: Sessione = { token, utente };
    this.sessione.set(sessione);
    try {
      localStorage.setItem(CHIAVE_STORAGE, JSON.stringify(sessione));
    } catch {
      this.log.warn('Impossibile salvare la sessione: al prossimo reload servirà un nuovo login.');
    }
  }

  private leggiSessioneSalvata(): Sessione | null {
    try {
      const grezza = localStorage.getItem(CHIAVE_STORAGE);
      if (!grezza) {
        return null;
      }
      const sessione = JSON.parse(grezza) as Sessione;
      if (!sessione.token || !sessione.utente || tokenScaduto(sessione.token)) {
        localStorage.removeItem(CHIAVE_STORAGE);
        return null;
      }
      return sessione;
    } catch {
      return null;
    }
  }
}

/**
 * Legge `exp` dal payload del JWT senza verificarne la firma: serve solo a evitare
 * di usare un token sicuramente scaduto, la validazione vera la fa il backend.
 */
export function tokenScaduto(token: string): boolean {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload)) as { exp?: number };
    return typeof exp !== 'number' || exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}
