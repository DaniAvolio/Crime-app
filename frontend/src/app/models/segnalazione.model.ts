import { Gravita } from './gravita.model';

export enum StatoSegnalazione {
  ATTIVA = 'ATTIVA',
  SCADUTA = 'SCADUTA',
  SOSPESA = 'SOSPESA',
  RIMOSSA = 'RIMOSSA',
}

export interface Segnalazione {
  id: number;
  /** null per le segnalazioni anonime, salvo per il loro autore e per gli admin. */
  autoreId: number | null;
  /** "Mario R."; null se anonima (salvo autore/admin) o se chi guarda non è autenticato. */
  autoreNome?: string | null;
  categoriaId: number;
  categoriaNome: string;
  categoriaGravita: Gravita;
  descrizione: string;
  lat: number;
  lng: number;
  anonima: boolean;
  stato: StatoSegnalazione;
  dataCreazione: string;
  dataScadenza: string;
  dataRimozione?: string;
  dataUltimaConferma?: string;
  /** Risposta dell'utente autenticato a "è ancora in atto?"; null se non ha votato o è ospite. */
  mioVoto?: boolean | null;
  /** L'utente autenticato ha già segnalato un problema; null per gli ospiti e in gestione. */
  mioAbuso?: boolean | null;
  // Coda di moderazione: valorizzati solo per gli admin, null per tutti gli altri.
  /** Abusi in attesa di decisione. */
  numeroAbusi?: number | null;
  /** Somma dei pesi degli abusi in attesa: alla soglia la segnalazione viene sospesa. */
  pesoAbusi?: number | null;
  /** In coda per l'admin: abusi in attesa o controlli automatici sulla descrizione. */
  daRivedere?: boolean | null;
  /** Controlli automatici scattati alla creazione, es. "MAIUSCOLE,RIPETIZIONI". */
  revisioneAutomatica?: string | null;
}
