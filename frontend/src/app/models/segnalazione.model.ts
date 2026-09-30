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
}
