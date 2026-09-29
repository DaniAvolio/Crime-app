import { Injectable, computed, effect, signal } from '@angular/core';

export type Tema = 'chiaro' | 'scuro';
/** Tema dello sfondo della mappa: 'auto' segue il tema dell'app. */
export type TemaMappa = 'auto' | Tema;

const CHIAVE_STORAGE = 'crime-app-tema';
const CHIAVE_TEMA_MAPPA = 'crime-app-tema-mappa';

/**
 * Stato globale del tema chiaro/scuro, condiviso da tutte le pagine. Applica la classe
 * `dark` sull'<html> (letta dalla variante `dark:` di Tailwind in tailwind.css) e
 * persiste la scelta dell'utente, cosi ogni pagina futura la eredita senza altra
 * configurazione: basta iniettare questo servizio o usare <app-theme-toggle>.
 *
 * L'applicazione avviene subito nel costruttore (non solo tramite l'effect, che viene
 * schedulato in modo asincrono): il servizio va inoltre iniettato da un componente sempre
 * montato (Nav), altrimenti resterebbe non istanziato finche' qualcosa non lo richiede
 * (es. l'apertura del pannello impostazioni), causando un cambio tema visibile solo al
 * primo click invece che al caricamento della pagina.
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly tema = signal<Tema>(this.leggiTemaIniziale());

  readonly temaAttuale = this.tema.asReadonly();

  /** Scelta dal profilo: la mappa può restare chiara con l'app scura, o viceversa. */
  private readonly sceltaMappa = signal<TemaMappa>(this.leggiTemaMappa());
  readonly temaMappaScelto = this.sceltaMappa.asReadonly();
  /** Tema effettivo dello sfondo della mappa. */
  readonly temaMappa = computed<Tema>(() => {
    const scelta = this.sceltaMappa();
    return scelta === 'auto' ? this.tema() : scelta;
  });

  constructor() {
    this.applicaTema(this.tema());
    effect(() => this.applicaTema(this.tema()));
  }

  alterna(): void {
    this.tema.update((tema) => (tema === 'scuro' ? 'chiaro' : 'scuro'));
  }

  impostaTemaMappa(scelta: TemaMappa): void {
    this.sceltaMappa.set(scelta);
    try {
      localStorage.setItem(CHIAVE_TEMA_MAPPA, scelta);
    } catch {
      // Storage non disponibile (es. navigazione privata): la scelta vale per questa sessione.
    }
  }

  private leggiTemaMappa(): TemaMappa {
    try {
      const salvato = localStorage.getItem(CHIAVE_TEMA_MAPPA);
      return salvato === 'chiaro' || salvato === 'scuro' ? salvato : 'auto';
    } catch {
      return 'auto';
    }
  }

  private applicaTema(tema: Tema): void {
    document.documentElement.classList.toggle('dark', tema === 'scuro');
    localStorage.setItem(CHIAVE_STORAGE, tema);
  }

  /** Se l'utente non ha mai scelto esplicitamente, il tema predefinito è scuro. */
  private leggiTemaIniziale(): Tema {
    const salvato = localStorage.getItem(CHIAVE_STORAGE);
    return salvato === 'chiaro' || salvato === 'scuro' ? salvato : 'scuro';
  }
}
