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
}
