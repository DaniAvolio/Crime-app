import { Injectable, computed, inject, signal } from '@angular/core';
import { Categoria } from '../models/categoria.model';
import { Segnalazione } from '../models/segnalazione.model';
import { LinguaService } from '../shared/lingua';
import { CategoriaApi } from './categoria-api';
import { nomeCategoria } from './categoria-i18n';

/**
 * Elenco categorie condiviso dalle pagine pubbliche: si scarica una volta sola (tutte, anche
 * le disattivate, perché vecchie segnalazioni possono ancora riferirle) e serve a tradurre il
 * nome di categoria delle segnalazioni tramite `categoriaId`.
 */
@Injectable({ providedIn: 'root' })
export class CategorieStore {
  private readonly categoriaApi = inject(CategoriaApi);
  private readonly lingua = inject(LinguaService);

  private readonly elenco = signal<Categoria[]>([]);
  readonly categorie = this.elenco.asReadonly();
  /** True dopo la prima risposta del backend, anche se in errore (l'elenco resta vuoto). */
  readonly caricate = signal(false);
  readonly perId = computed(() => new Map(this.elenco().map((c) => [c.id, c])));

  private inCorso = false;

  /** Scarica le categorie se non sono già in memoria; chiamarla più volte è innocuo. */
  carica(): void {
    if (this.caricate() || this.inCorso) {
      return;
    }
    this.ricarica();
  }

  /** Allinea lo store a un elenco completo già scaricato altrove (es. la gestione categorie). */
  imposta(categorie: Categoria[]): void {
    this.elenco.set(categorie);
    this.caricate.set(true);
  }

  private ricarica(): void {
    this.inCorso = true;
    this.categoriaApi.elenca().subscribe({
      next: (categorie) => {
        this.elenco.set(categorie);
        this.fine();
      },
      error: () => this.fine(),
    });
  }

  /** Nome della categoria nella lingua attiva; per una segnalazione il fallback è il nome italiano. */
  nome(categoria: Categoria | Segnalazione): string {
    const lingua = this.lingua.attiva();
    if ('categoriaId' in categoria) {
      const trovata = this.perId().get(categoria.categoriaId);
      return trovata ? nomeCategoria(trovata, lingua) : categoria.categoriaNome;
    }
    return nomeCategoria(categoria, lingua);
  }

  private fine(): void {
    this.inCorso = false;
    this.caricate.set(true);
  }
}
