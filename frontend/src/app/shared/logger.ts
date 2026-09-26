import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export type LivelloLog = 'debug' | 'info' | 'warn' | 'error';

const PRIORITA: Record<LivelloLog, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * Logger centralizzato da usare al posto di `console.*`. Il livello minimo arriva da
 * `environment.logLevel` (debug in sviluppo, warn in produzione): i messaggi sotto soglia
 * vengono scartati, cosi' i log di dettaglio non finiscono nella console degli utenti.
 *
 * Uso: `private readonly log = inject(LoggerService);` -> `this.log.info('Categorie caricate', n)`.
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly livelloMinimo = PRIORITA[environment.logLevel];

  debug(messaggio: string, ...dati: unknown[]): void {
    this.scrivi('debug', messaggio, dati);
  }

  info(messaggio: string, ...dati: unknown[]): void {
    this.scrivi('info', messaggio, dati);
  }

  warn(messaggio: string, ...dati: unknown[]): void {
    this.scrivi('warn', messaggio, dati);
  }

  error(messaggio: string, ...dati: unknown[]): void {
    this.scrivi('error', messaggio, dati);
  }

  private scrivi(livello: LivelloLog, messaggio: string, dati: unknown[]): void {
    if (PRIORITA[livello] < this.livelloMinimo) {
      return;
    }
    const prefisso = `[${new Date().toISOString()}] ${livello.toUpperCase()}`;
    console[livello](prefisso, messaggio, ...dati);
  }
}
