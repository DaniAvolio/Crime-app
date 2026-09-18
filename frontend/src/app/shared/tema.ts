import { Injectable, effect, signal } from '@angular/core';

export type Tema = 'chiaro' | 'scuro';

const CHIAVE_STORAGE = 'crime-app-tema';

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

  constructor() {
    this.applicaTema(this.tema());
    effect(() => this.applicaTema(this.tema()));
  }

  alterna(): void {
    this.tema.update((tema) => (tema === 'scuro' ? 'chiaro' : 'scuro'));
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
