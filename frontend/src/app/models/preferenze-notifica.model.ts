import { Gravita } from './gravita.model';
import { StatoSegnalazione } from './segnalazione.model';

/** Preferenze delle notifiche dell'utente (i default se non le ha mai salvate). */
export interface PreferenzeNotifica {
  /** Interruttore generale: spento, nessun avviso (né in app né push). */
  notificheAttive: boolean;
  /** Gravità minima delle segnalazioni vicine da notificare. */
  gravitaMinima: Gravita;
  /** Categorie scelte; vuoto = tutte quelle con gravità sufficiente. */
  categorieId: number[];
  /** Ore di silenzio "HH:mm" (ora italiana), entrambe null = nessuna. */
  oreSilenzioDa: string | null;
  oreSilenzioA: string | null;
  /** Le gravi arrivano come push anche durante il silenzio. */
  graviInSilenzio: boolean;
  /** Avvisi sulle proprie segnalazioni (confermata, chiusa, rimossa, sospesa). */
  aggiornamentiMie: boolean;
}

/** Zona in cui ricevere gli avvisi (es. Casa, Lavoro): al massimo 5. */
export interface ZonaNotifica {
  id: number;
  nome: string;
  lat: number;
  lng: number;
  raggioMetri: number;
}

export type TipoNotifica = 'VICINA' | 'CONFERMATA' | 'CHIUSA' | 'RIMOSSA' | 'SOSPESA';

/** Avviso della campanella: il testo si compone nella lingua attiva da tipo, categoria e zona. */
export interface Notifica {
  id: number;
  tipo: TipoNotifica;
  segnalazioneId: number;
  categoriaId: number;
  /** Solo per VICINA. */
  zonaNome: string | null;
  /** Stato attuale della segnalazione. */
  stato: StatoSegnalazione;
  dataCreazione: string;
  letta: boolean;
}
