import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { LucideDynamicIcon } from '@lucide/angular';
import { CategoriaApi, CategoriaRequest } from './categoria-api';
import { Categoria } from '../models/categoria.model';
import { NOME_ICONA_FALLBACK, NOMI_ICONE_DISPONIBILI } from '../shared/icone-categoria';

@Component({
  selector: 'app-categorie',
  standalone: true,
  imports: [ReactiveFormsModule, LucideDynamicIcon],
  templateUrl: './categorie.html',
})
export class Categorie implements OnInit {
  private readonly categoriaApi = inject(CategoriaApi);
  private readonly fb = inject(FormBuilder);

  /** Nomi delle icone selezionabili, suggeriti nel form tramite datalist. */
  protected readonly nomiIconeDisponibili = NOMI_ICONE_DISPONIBILI;

  protected readonly categorie = signal<Categoria[]>([]);
  protected readonly caricando = signal(false);
  protected readonly errore = signal<string | null>(null);
  /** Id della categoria in modifica, null quando il form serve a crearne una nuova. */
  protected readonly idInModifica = signal<number | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    nome: ['', Validators.required],
    descrizione: [''],
    icona: [''],
    durataValiditaOre: [24, [Validators.required, Validators.min(1)]],
  });

  ngOnInit(): void {
    this.carica();
  }

  protected carica(): void {
    this.caricando.set(true);
    this.errore.set(null);
    this.categoriaApi.elenca().subscribe({
      next: (categorie) => {
        this.categorie.set(categorie);
        this.caricando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errore.set(this.estraiMessaggio(err));
        this.caricando.set(false);
      },
    });
  }

  protected inviaForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload: CategoriaRequest = this.form.getRawValue();
    const id = this.idInModifica();
    const richiesta = id === null
      ? this.categoriaApi.crea(payload)
      : this.categoriaApi.aggiorna(id, payload);

    this.errore.set(null);
    richiesta.subscribe({
      next: () => {
        this.resetForm();
        this.carica();
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
    });
  }

  protected annullaModifica(): void {
    this.resetForm();
  }

  protected disattiva(categoria: Categoria): void {
    this.errore.set(null);
    this.categoriaApi.disattiva(categoria.id).subscribe({
      next: () => this.carica(),
      error: (err: HttpErrorResponse) => this.errore.set(this.estraiMessaggio(err)),
    });
  }

  protected riattiva(categoria: Categoria): void {
    this.errore.set(null);
    this.categoriaApi.riattiva(categoria.id).subscribe({
      next: () => this.carica(),
      error: (err: HttpErrorResponse) => this.errore.set(this.estraiMessaggio(err)),
    });
  }

  protected elimina(categoria: Categoria): void {
    const confermato = confirm(
      `Eliminare definitivamente la categoria "${categoria.nome}"? L'operazione non è reversibile.`,
    );
    if (!confermato) {
      return;
    }
    this.errore.set(null);
    this.categoriaApi.eliminaDefinitivamente(categoria.id).subscribe({
      next: () => this.carica(),
      error: (err: HttpErrorResponse) => this.errore.set(this.estraiMessaggio(err)),
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
    this.form.reset({ nome: '', descrizione: '', icona: '', durataValiditaOre: 24 });
  }

  private estraiMessaggio(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Impossibile contattare il backend: controlla che sia avviato su localhost:8080.';
    }
    return err.error?.messaggio ?? `Errore ${err.status}: ${err.statusText}`;
  }
}
