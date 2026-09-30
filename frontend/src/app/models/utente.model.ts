export type RuoloUtente = 'UTENTE' | 'ADMIN';

export interface Utente {
  id: number;
  nome: string;
  cognome: string;
  email: string;
  identitaVerificata: boolean;
  punteggioFiducia: number;
  attivo: boolean;
  ruolo: RuoloUtente;
  dataRegistrazione: string; // ISO 8601
  dataAggiornamento?: string;
  /** Contatori di attività: restano anche dopo l'anonimizzazione delle segnalazioni vecchie. */
  segnalazioniFatte: number;
  /** Segnalazioni che hanno ricevuto almeno un "è ancora in atto" da un altro utente. */
  segnalazioniConfermate: number;
  /** Segnalazioni rimosse da un amministratore. */
  segnalazioniRimosse: number;
}
