import { NgClass } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslocoService } from '@jsverse/transloco';
import { CategoriaApi, CategoriaRequest, FiltriGestioneCategorie } from './categoria-api';
import { CategorieStore } from './categorie-store';
import { Categoria } from '../models/categoria.model';
import { GRAVITA, Gravita } from '../models/gravita.model';
import { classeGravita } from '../shared/gravita';
import { NOME_ICONA_FALLBACK, NOMI_ICONE_DISPONIBILI } from '../shared/icone-categoria';
import { DialoghiService } from '../shared/dialoghi/dialoghi';
import { IntestazioneOrdinabile } from '../shared/tabella/intestazione-ordinabile';
import { IndicatoreCaricamento } from '../shared/tabella/indicatore-caricamento';
import { Paginazione } from '../shared/tabella/paginazione';
import { TabellaRemota } from '../shared/tabella/tabella';
import { ToastService } from '../shared/toast/toast';

@Component({
  selector: 'app-categorie',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    LucideDynamicIcon,
    NgClass,
    IntestazioneOrdinabile,
    Paginazione,
    IndicatoreCaricamento,
  ],
  templateUrl: './categorie.html',
})
export class Categorie {
  private readonly categoriaApi = inject(CategoriaApi);
  private readonly store = inject(CategorieStore);
  private readonly fb = inject(FormBuilder);
  private readonly dialoghi = inject(DialoghiService);
  private readonly toast = inject(ToastService);

  /** Nomi delle icone selezionabili, suggeriti nel form tramite datalist. */
  protected readonly nomiIconeDisponibili = NOMI_ICONE_DISPONIBILI;

  protected readonly errore = signal<string | null>(null);

  /** Paginata, filtrata e ordinata dal backend; di default le più gravi (3 -> 1), poi per nome. */
  protected readonly tabella = new TabellaRemota<FiltriGestioneCategorie, Categoria>(
    (richiesta) => this.categoriaApi.pagina(richiesta),
    { nome: '', gravita: '', durataMin: '', durataMax: '', attiva: '' },
    { campo: 'gravita', direzione: 'desc' },
  );
  protected readonly erroreTabella = computed(() => {
    const err = this.tabella.errore();
    return err ? this.estraiMessaggio(err) : null;
  });

  /** Id della categoria in modifica, null quando il form serve a crearne una nuova. */
  protected readonly idInModifica = signal<number | null>(null);

  /**
   * Lingue da tradurre: tutte quelle dell'app tranne l'italiano, che è la lingua di nome e
   * descrizione. Aggiungere una lingua in app.config.ts la fa comparire qui da sola.
   */
  protected readonly lingueTraduzione = inject(TranslocoService)
    .getAvailableLangs()
    .map((lingua) => (typeof lingua === 'string' ? lingua : lingua.id))
    .filter((lingua) => lingua !== 'it');

  protected readonly form = this.fb.nonNullable.group({
    nome: ['', Validators.required],
    descrizione: [''],
    icona: [''],
    durataValiditaOre: [24, [Validators.required, Validators.min(1)]],
    gravita: [1 as Gravita, Validators.required],
    // Nome vuoto = traduzione assente: per quella lingua si mostra l'italiano.
    traduzioni: this.fb.nonNullable.group(
      Object.fromEntries(
        this.lingueTraduzione.map((lingua) => [
          lingua,
          this.fb.nonNullable.group({ nome: [''], descrizione: [''] }),
        ]),
      ),
    ),
  });

  protected readonly livelliGravita = GRAVITA;
  protected readonly etichetteGravita: Record<Gravita, string> = {
    1: 'Bassa (degrado, quiete)',
    2: 'Media (patrimonio)',
    3: 'Alta (contro la persona)',
  };
  protected readonly classeGravita = classeGravita;

  /** Dopo una modifica: ricarica la pagina e lo store usato da mappa e form di segnalazione. */
  private aggiorna(): void {
    this.tabella.aggiorna();
    this.store.ricarica();
  }

  protected inviaForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload: CategoriaRequest = this.form.getRawValue();
    const id = this.idInModifica();
    const richiesta =
      id === null ? this.categoriaApi.crea(payload) : this.categoriaApi.aggiorna(id, payload);

    this.errore.set(null);
    richiesta.subscribe({
      next: () => {
        this.toast.successo(id === null ? 'Categoria creata.' : 'Categoria aggiornata.');
        this.resetForm();
        this.aggiorna();
      },
      error: (err: HttpErrorResponse) => this.errore.set(this.estraiMessaggio(err)),
    });
  }

  protected modifica(categoria: Categoria): void {
    this.idInModifica.set(categoria.id);
    this.form.setValue({
      nome: categoria.nome,
      descrizione: categoria.descrizione ?? '',
      icona: categoria.icona ?? '',
      durataValiditaOre: categoria.durataValiditaOre,
      gravita: categoria.gravita,
      traduzioni: Object.fromEntries(
        this.lingueTraduzione.map((lingua) => [
          lingua,
          {
            nome: categoria.traduzioni?.[lingua]?.nome ?? '',
            descrizione: categoria.traduzioni?.[lingua]?.descrizione ?? '',
          },
        ]),
      ),
    });
  }

  protected annullaModifica(): void {
    this.resetForm();
  }

  protected disattiva(categoria: Categoria): void {
    this.errore.set(null);
    this.categoriaApi.disattiva(categoria.id).subscribe({
      next: () => this.aggiorna(),
      error: (err: HttpErrorResponse) => this.errore.set(this.estraiMessaggio(err)),
    });
  }

  protected riattiva(categoria: Categoria): void {
    this.errore.set(null);
    this.categoriaApi.riattiva(categoria.id).subscribe({
      next: () => this.aggiorna(),
      error: (err: HttpErrorResponse) => this.errore.set(this.estraiMessaggio(err)),
    });
  }

  protected async elimina(categoria: Categoria): Promise<void> {
    const confermato = await this.dialoghi.conferma({
      titolo: 'Eliminare la categoria?',
      messaggio: `"${categoria.nome}" verrà eliminata definitivamente. L'operazione non è reversibile.`,
      conferma: 'Elimina',
      pericolo: true,
    });
    if (!confermato) {
      return;
    }
    this.errore.set(null);
    this.categoriaApi.eliminaDefinitivamente(categoria.id).subscribe({
      next: () => {
        this.toast.successo(`Categoria "${categoria.nome}" eliminata.`);
        this.aggiorna();
      },
      error: (err: HttpErrorResponse) => {
        this.errore.set(this.estraiMessaggio(err));
        this.toast.errore('Non siamo riusciti a eliminare la categoria.');
      },
    });
  }

  /**
   * Restituisce il nome icona (kebab-case) da passare a lucideIcon: se il valore salvato non
   * corrisponde a nessuna icona registrata (es. vuoto, refuso, vecchia emoji) ricade su un'icona
   * neutra invece di lasciar rompere il rendering.
   */
  protected iconaRisolta(nome: string | null | undefined): string {
    if (nome && this.nomiIconeDisponibili.includes(nome)) {
      return nome;
    }
    return NOME_ICONA_FALLBACK;
  }

  private resetForm(): void {
    this.idInModifica.set(null);
    this.form.reset({ nome: '', descrizione: '', icona: '', durataValiditaOre: 24, gravita: 1 });
  }

  private estraiMessaggio(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Impossibile contattare il backend: controlla che sia avviato su localhost:8080.';
    }
    return err.error?.messaggio ?? `Errore ${err.status}: ${err.statusText}`;
  }
}
