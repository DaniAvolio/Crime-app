/** Pagina di risultati delle tabelle di gestione (PaginaDto del backend). `pagina` parte da 0. */
export interface Pagina<T> {
  contenuto: T[];
  pagina: number;
  dimensione: number;
  totaleElementi: number;
  totalePagine: number;
}
