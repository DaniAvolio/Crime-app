import { Gravita } from './gravita.model';

export interface Categoria {
  id: number;
  nome: string;
  descrizione?: string;
  icona?: string;
  /** Durata di validità in ore prima della scadenza automatica. */
  durataValiditaOre: number;
  /** Decide il colore dei marker e il filtro per gravità sulla mappa. */
  gravita: Gravita;
  attiva: boolean;
}
