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
  categoriaId: number;
  categoriaNome: string;
  descrizione: string;
  lat: number;
  lng: number;
  anonima: boolean;
  stato: StatoSegnalazione;
  dataCreazione: string;
  dataScadenza: string;
  dataRimozione?: string;
  dataUltimaConferma?: string;
}
