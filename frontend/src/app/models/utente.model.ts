export interface Utente {
  id: number;
  nome: string;
  cognome: string;
  email: string;
  identitaVerificata: boolean;
  punteggioFiducia: number;
  attivo: boolean;
  dataRegistrazione: string; // ISO 8601
  dataAggiornamento?: string;
}
