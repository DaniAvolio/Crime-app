import { SlicePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CategoriaApi } from '../../categorie/categoria-api';
import { Categoria } from '../../models/categoria.model';
import { Segnalazione, StatoSegnalazione } from '../../models/segnalazione.model';
import { Utente } from '../../models/utente.model';
import { UtenteApi } from '../utenti/utente-api';
import { SegnalazioneApi, SegnalazioneRequest } from './segnalazione-api';
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
  private readonly utenteApi = inject(UtenteApi);
  private readonly fb = inject(FormBuilder);
  private readonly dialoghi = inject(DialoghiService);
  private readonly toast = inject(ToastService);

  protected readonly StatoSegnalazione = StatoSegnalazione;

  protected readonly segnalazioni = signal<Segnalazione[]>([]);
  protected readonly categorie = signal<Categoria[]>([]);
  protected readonly utenti = signal<Utente[]>([]);
  protected readonly caricando = signal(false);
  protected readonly errore = signal<string | null>(null);
  protected readonly filtroStato = signal<StatoSegnalazione | ''>('');

  protected readonly form = this.fb.nonNullable.group({
    autoreId: this.fb.control<number | null>(null, Validators.required),
    categoriaId: this.fb.control<number | null>(null, Validators.required),
    descrizione: ['', Validators.required],
    lat: [0, Validators.required],
    lng: [0, Validators.required],
    anonima: [false],
  });

  ngOnInit(): void {
    this.categoriaApi.elenca().subscribe({ next: (categorie) => this.categorie.set(categorie) });
    this.utenteApi.elenca().subscribe({ next: (utenti) => this.utenti.set(utenti) });
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
      autoreId: valori.autoreId!,
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

  /** Non c'è un utente loggato: chiediamo esplicitamente chi sta agendo e perché. */
  private async chiediTransizione(
    titolo: string,
    conferma: string,
    pericolo = false,
  ): Promise<{ attoreId: number; motivazione: string } | null> {
    const valori = await this.dialoghi.chiedi({
      titolo,
      conferma,
      pericolo,
      campi: [
        {
          nome: 'attoreId',
          etichetta: "Id dell'utente che esegue l'operazione",
          tipo: 'number',
          obbligatorio: true,
        },
        { nome: 'motivazione', etichetta: 'Motivazione', tipo: 'textarea', obbligatorio: true },
      ],
    });
    return valori
      ? { attoreId: Number(valori['attoreId']), motivazione: valori['motivazione'] }
      : null;
  }

  private resetForm(): void {
    this.form.reset({
      autoreId: null,
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
