import { Gravita } from '../models/gravita.model';

/**
 * Classi Tailwind per gravità, scritte per intero perché Tailwind le trovi scansionando i
 * sorgenti. Sul giallo l'icona è scura: il bianco non avrebbe abbastanza contrasto.
 */
const SFONDO_CON_TESTO: Record<Gravita, string> = {
  1: 'bg-gravita-1 text-ink',
  2: 'bg-gravita-2 text-white',
  3: 'bg-gravita-3 text-white',
};

const SFONDO: Record<Gravita, string> = {
  1: 'bg-gravita-1',
  2: 'bg-gravita-2',
  3: 'bg-gravita-3',
};

/** Bolla con icona (dettaglio, lista, badge in gestione): sfondo del colore e testo leggibile. */
export function classeGravita(gravita: Gravita): string {
  return SFONDO_CON_TESTO[gravita] ?? SFONDO_CON_TESTO[1];
}

/** Solo il colore, per pallini e indicatori. */
export function classePallinoGravita(gravita: Gravita): string {
  return SFONDO[gravita] ?? SFONDO[1];
}

/** Chiave i18n dell'etichetta (Bassa / Media / Alta). */
export function chiaveGravita(gravita: Gravita): string {
  return `gravita.${gravita}`;
}
