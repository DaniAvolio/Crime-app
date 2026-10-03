import { Tema } from '../shared/tema';

/*
 * Scala sequenziale delle statistiche (mappa di calore e fasce orarie): una sola tinta rossa,
 * luminosità monotona (verificata con il validatore della skill dataviz). Sul tema chiaro va da
 * chiaro (poche) a scuro (molte); sul tema scuro è invertita, così "molte" resta il più visibile.
 * Il primo passo può confondersi con lo sfondo: è voluto, "quasi zero" deve sparire. Le celle a
 * zero usano un grigio neutro a parte (VUOTO), così "nessuna" non si confonde con "poche".
 */
export const RAMPA: Record<Tema, readonly string[]> = {
  chiaro: ['#fde0dd', '#fbb4ae', '#f6807a', '#e9504a', '#c92a2a', '#9b1c1f', '#6b1114'],
  scuro: ['#3b1518', '#5e1a1d', '#8a2024', '#b8282b', '#e0413f', '#f47a72', '#fbb4ae'],
};

export const VUOTO: Record<Tema, string> = { chiaro: '#f1f2f4', scuro: '#1f2631' };

/** Colore dei segni a tinta unica (colonne dell'andamento, barre delle categorie). */
export const COLORE_SERIE: Record<Tema, string> = { chiaro: '#e9504a', scuro: '#e0413f' };

/** Passo della rampa per un valore in [0, massimo] (massimo > 0); 0 = VUOTO. */
export function coloreIntensita(valore: number, massimo: number, tema: Tema): string {
  if (valore <= 0 || massimo <= 0) {
    return VUOTO[tema];
  }
  const passi = RAMPA[tema];
  const indice = Math.min(
    passi.length - 1,
    Math.floor((valore / massimo) * (passi.length - 1) + 0.5),
  );
  return passi[Math.max(0, indice)];
}
