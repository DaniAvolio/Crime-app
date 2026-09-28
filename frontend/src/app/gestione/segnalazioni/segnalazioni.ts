import { SlicePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CategoriaApi } from '../../categorie/categoria-api';
import { Categoria } from '../../models/categoria.model';
import { Segnalazione, StatoSegnalazione } from '../../models/segnalazione.model';
import {
  SegnalazioneApi,
  SegnalazioneRequest,
  SegnalazioneTransizioneRequest,
} from './segnalazione-api';
import { DialoghiService } from '../../shared/dialoghi/dialoghi';
import { ToastService } from '../../shared/toast/toast';

@Component({
  selector: 'app-segnalazioni',
  standalone: true,
  imports: [ReactiveFormsModule, SlicePipe],
  templateUrl: './segnalazioni.html',
})
export class Segnalazioni implements OnInit {
  private readonly segnalazioneApi = inject(SegnalazioneApi);
  private readonly categoriaApi = inject(CategoriaApi);
  private readonly fb = inject(FormBuilder);
  private readonly dialoghi = inject(DialoghiService);
  private readonly toast = inject(ToastService);

  protected readonly StatoSegnalazione = StatoSegnalazione;

  protected readonly segnalazioni = signal<Segnalazione[]>([]);
  protected readonly categorie = signal<Categoria[]>([]);
  protected readonly caricando = signal(false);
  protected readonly errore = signal<string | null>(null);
  protected readonly filtroStato = signal<StatoSegnalazione | ''>('');

  protected readonly form = this.fb.nonNullable.group({
    categoriaId: this.fb.control<number | null>(null, Validators.required),
    descrizione: ['', Validators.required],
    lat: [0, Validators.required],
    lng: [0, Validators.required],
    anonima: [false],
  });

  ngOnInit(): void {
    this.categoriaApi.elenca().subscribe({ next: (categorie) => this.categorie.set(categorie) });
    this.carica();
  }

  protected carica(): void {
    this.caricando.set(true);
    this.errore.set(null);
    const stato = this.filtroStato();
    this.segnalazioneApi.elenca(stato ? { stato } : undefined).subscribe({
      next: (segnalazioni) => {
        this.segnalazioni.set(segnalazioni);
        this.caricando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errore.set(this.estraiMessaggio(err));
        this.caricando.set(false);
      },
    });
  }

  protected cambiaFiltro(stato: string): void {
    this.filtroStato.set(stato as StatoSegnalazione | '');
    this.carica();
  }

  protected inviaForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valori = this.form.getRawValue();
    const payload: SegnalazioneRequest = {
      categoriaId: valori.categoriaId!,
      descrizione: valori.descrizione,
      lat: valori.lat,
      lng: valori.lng,
      anonima: valori.anonima,
    };
    this.errore.set(null);
    this.segnalazioneApi.crea(payload).subscribe({
      next: () => {
        this.resetForm();
        this.carica();
      },
      error: (err: HttpErrorResponse) => this.errore.set(this.estraiMessaggio(err)),
    });
  }

  protected async rimuovi(segnalazione: Segnalazione): Promise<void> {
    const richiesta = await this.chiediTransizione('Rimuovere la segnalazione?', 'Rimuovi', true);
    if (!richiesta) {
      return;
    }
    this.errore.set(null);
    this.segnalazioneApi.rimuovi(segnalazione.id, richiesta).subscribe({
      next: () => {
        this.toast.successo('Segnalazione rimossa.');
        this.carica();
      },
      error: (err: HttpErrorResponse) => {
        this.errore.set(this.estraiMessaggio(err));
        this.toast.errore('Non siamo riusciti a rimuovere la segnalazione.');
      },
    });
  }

  protected async riattiva(segnalazione: Segnalazione): Promise<void> {
    const richiesta = await this.chiediTransizione('Riattivare la segnalazione?', 'Riattiva');
    if (!richiesta) {
      return;
    }
    this.errore.set(null);
    this.segnalazioneApi.riattiva(segnalazione.id, richiesta).subscribe({
      next: () => {
        this.toast.successo('Segnalazione riattivata.');
        this.carica();
      },
      error: (err: HttpErrorResponse) => {
        this.errore.set(this.estraiMessaggio(err));
        this.toast.errore('Non siamo riusciti a riattivare la segnalazione.');
      },
    });
  }

  /**
   * Cancellazione definitiva dal database (voti, abusi e storico di moderazione compresi).
   * Diversa da "Rimuovi", che cambia solo lo stato: serve ad esempio per poter poi eliminare
   * una categoria, bloccata finché ha segnalazioni.
   */
  protected async elimina(segnalazione: Segnalazione): Promise<void> {
    const confermato = await this.dialoghi.conferma({
      titolo: 'Eliminare definitivamente la segnalazione?',
      messaggio: `"${segnalazione.categoriaNome}" #${segnalazione.id} verrà cancellata dal database insieme a voti, segnalazioni di abuso e storico di moderazione. L'operazione non è reversibile.`,
      conferma: 'Elimina',
      pericolo: true,
    });
    if (!confermato) {
      return;
    }
    this.errore.set(null);
    this.segnalazioneApi.eliminaDefinitivamente(segnalazione.id).subscribe({
      next: () => {
        this.toast.successo('Segnalazione eliminata definitivamente.');
        this.carica();
      },
      error: (err: HttpErrorResponse) => {
        this.errore.set(this.estraiMessaggio(err));
        this.toast.errore('Non siamo riusciti a eliminare la segnalazione.');
      },
    });
  }

  /** L'attore è l'admin autenticato (il backend lo ricava dal token): serve solo il perché. */
  private async chiediTransizione(
    titolo: string,
    conferma: string,
    pericolo = false,
  ): Promise<SegnalazioneTransizioneRequest | null> {
    const valori = await this.dialoghi.chiedi({
      titolo,
      conferma,
      pericolo,
      campi: [
        { nome: 'motivazione', etichetta: 'Motivazione', tipo: 'textarea', obbligatorio: true },
      ],
    });
    return valori ? { motivazione: valori['motivazione'] } : null;
  }

  private resetForm(): void {
    this.form.reset({
      categoriaId: null,
      descrizione: '',
      lat: 0,
      lng: 0,
      anonima: false,
    });
  }

  private estraiMessaggio(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Impossibile contattare il backend: controlla che sia avviato su localhost:8080.';
    }
    return err.error?.messaggio ?? `Errore ${err.status}: ${err.statusText}`;
  }
}
