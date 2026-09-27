import { Injectable, signal } from '@angular/core';

export type TipoToast = 'successo' | 'errore' | 'info';

export interface AzioneToast {
  etichetta: string;
  esegui: () => void;
}

export interface OpzioniToast {
  /** Millisecondi prima della chiusura automatica (default 4s, 7s per gli errori). */
  durata?: number;
  azione?: AzioneToast;
}

export interface Toast {
  id: number;
  tipo: TipoToast;
  messaggio: string;
  durata: number;
  azione?: AzioneToast;
}

const DURATA_PREDEFINITA_MS = 4000;
const DURATA_ERRORE_MS = 7000;
const MASSIMO_VISIBILI = 3;

/**
 * Notifiche brevi e non bloccanti, mostrate da <app-contenitore-toast>:
 *
 *   toast.successo('Categoria eliminata.');
 *   toast.errore('Non riusciamo a eliminare la categoria.');
 *
 * La chiusura automatica la gestisce il contenitore (che la sospende al passaggio del mouse).
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly elenco = signal<Toast[]>([]);
  readonly toast = this.elenco.asReadonly();
  private prossimoId = 1;

  successo(messaggio: string, opzioni?: OpzioniToast): number {
    return this.mostra('successo', messaggio, opzioni);
  }

  errore(messaggio: string, opzioni?: OpzioniToast): number {
    return this.mostra('errore', messaggio, opzioni);
  }

  info(messaggio: string, opzioni?: OpzioniToast): number {
    return this.mostra('info', messaggio, opzioni);
  }

  chiudi(id: number): void {
    this.elenco.update((elenco) => elenco.filter((t) => t.id !== id));
  }

  private mostra(tipo: TipoToast, messaggio: string, opzioni?: OpzioniToast): number {
    const id = this.prossimoId++;
    const durata =
      opzioni?.durata ?? (tipo === 'errore' ? DURATA_ERRORE_MS : DURATA_PREDEFINITA_MS);
    // I più recenti in cima; oltre il massimo si scartano i più vecchi.
    this.elenco.update((elenco) =>
      [{ id, tipo, messaggio, durata, azione: opzioni?.azione }, ...elenco].slice(
        0,
        MASSIMO_VISIBILI,
      ),
    );
    return id;
  }
}
