/** Perché un utente segnala un problema su una segnalazione ("Segnala un problema"). */
export type MotivoAbuso =
  'FALSA' | 'OFFENSIVA' | 'DATI_PERSONALI' | 'SPAM' | 'CATEGORIA_ERRATA' | 'ALTRO';

/** Nell'ordine in cui si mostrano all'utente. */
export const MOTIVI_ABUSO: readonly MotivoAbuso[] = [
  'FALSA',
  'OFFENSIVA',
  'DATI_PERSONALI',
  'SPAM',
  'CATEGORIA_ERRATA',
  'ALTRO',
];

/** Decisione dell'admin sugli abusi in attesa; null = in attesa. */
export type EsitoAbuso = 'FONDATO' | 'INFONDATO';

/** Segnalazione di abuso come la vede l'admin (l'elenco è riservato agli admin). */
export interface SegnalazioneAbuso {
  id: number;
  segnalazioneId: number;
  utenteId: number;
  /** Fiducia attuale di chi l'ha inviata (0–100). */
  utenteFiducia: number;
  motivo: MotivoAbuso;
  nota: string | null;
  /** Peso al momento dell'invio: fiducia / 100, minimo 0.25. */
  peso: number;
  esito: EsitoAbuso | null;
  dataSegnalazione: string;
}

/** Controlli sulla descrizione che il backend può segnalare quando rifiuta una pubblicazione. */
export type TipoViolazione =
  | 'TROPPO_CORTA'
  | 'DATI_PERSONALI'
  | 'LINK'
  | 'LINGUAGGIO_OFFENSIVO'
  | 'DISCRIMINAZIONE'
  | 'MAIUSCOLE'
  | 'RIPETIZIONI';

export interface Violazione {
  tipo: TipoViolazione;
  /** Il pezzo di testo che ha fatto scattare il controllo. */
  frammento: string;
}
