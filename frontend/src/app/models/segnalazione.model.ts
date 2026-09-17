export enum StatoSegnalazione {
  ATTIVA = 'ATTIVA',
  SCADUTA = 'SCADUTA',
  SOSPESA = 'SOSPESA',
  RIMOSSA = 'RIMOSSA',
}

export interface Posizione {
  lat: number;
  lng: number;
}

export interface Segnalazione {
  id: number;
  categoriaId: number;
  descrizione: string;
  posizione: Posizione;
  /** L'autore reale non è mai esposto se anonima=true: solo il flag lato UI. */
  anonima: boolean;
  autoreNome?: string; // presente solo se anonima=false
  stato: StatoSegnalazione;
  dataCreazione: string;
  dataScadenza: string;
  dataRimozione?: string;
}
