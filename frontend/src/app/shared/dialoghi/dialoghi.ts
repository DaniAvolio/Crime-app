import { Injectable, signal } from '@angular/core';

export interface OpzioniConferma {
  titolo: string;
  messaggio?: string;
  /** Testo del bottone di conferma (default: "Conferma" tradotto). */
  conferma?: string;
  /** Testo del bottone di annullamento (default: "Annulla" tradotto). */
  annulla?: string;
  /** Azione distruttiva: icona di avviso e focus iniziale su "Annulla" invece che su "Conferma". */
  pericolo?: boolean;
}

export interface CampoDialogo {
  nome: string;
  etichetta: string;
  tipo?: 'text' | 'number' | 'textarea';
  obbligatorio?: boolean;
  valoreIniziale?: string;
  placeholder?: string;
}

export interface OpzioniRichiesta extends OpzioniConferma {
  campi: CampoDialogo[];
}

/** Richiesta attualmente mostrata da <app-dialogo>, con la funzione che ne chiude la Promise. */
export type DialogoAperto =
  | { tipo: 'conferma'; opzioni: OpzioniConferma; chiudi: (esito: boolean) => void }
  | {
      tipo: 'chiedi';
      opzioni: OpzioniRichiesta;
      chiudi: (valori: Record<string, string> | null) => void;
    };

/**
 * Modal di conferma e di richiesta dati, al posto di confirm()/prompt() del browser.
 * Un dialog alla volta: aprirne uno nuovo annulla quello ancora aperto.
 *
 *   if (await dialoghi.conferma({ titolo: 'Eliminare?', pericolo: true })) { ... }
 *   const valori = await dialoghi.chiedi({ titolo: '...', campi: [...] }); // null se annullato
 */
@Injectable({ providedIn: 'root' })
export class DialoghiService {
  private readonly aperto = signal<DialogoAperto | null>(null);
  readonly dialogoAperto = this.aperto.asReadonly();

  conferma(opzioni: OpzioniConferma): Promise<boolean> {
    this.annullaAperto();
    return new Promise((risolvi) =>
      this.aperto.set({
        tipo: 'conferma',
        opzioni,
        chiudi: (esito) => {
          this.aperto.set(null);
          risolvi(esito);
        },
      }),
    );
  }

  chiedi(opzioni: OpzioniRichiesta): Promise<Record<string, string> | null> {
    this.annullaAperto();
    return new Promise((risolvi) =>
      this.aperto.set({
        tipo: 'chiedi',
        opzioni,
        chiudi: (valori) => {
          this.aperto.set(null);
          risolvi(valori);
        },
      }),
    );
  }

  private annullaAperto(): void {
    const aperto = this.aperto();
    if (aperto?.tipo === 'conferma') {
      aperto.chiudi(false);
    } else if (aperto?.tipo === 'chiedi') {
      aperto.chiudi(null);
    }
  }
}
