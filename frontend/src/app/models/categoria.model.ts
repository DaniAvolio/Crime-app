export interface Categoria {
  id: number;
  nome: string;
  descrizione?: string;
  icona?: string;
  /** Durata di validità in ore prima della scadenza automatica. */
  durataValiditaOre: number;
  attiva: boolean;
}
