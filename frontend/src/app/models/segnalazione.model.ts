export enum StatoSegnalazione {
  ATTIVA = 'ATTIVA',
  SCADUTA = 'SCADUTA',
  SOSPESA = 'SOSPESA',
  RIMOSSA = 'RIMOSSA',
}

export interface Segnalazione {
  id: number;
  autoreId: number;
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
}
