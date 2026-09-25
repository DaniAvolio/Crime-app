import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Utente } from '../../models/utente.model';
import { UtenteAggiornamentoRequest, UtenteApi, UtenteRegistrazioneRequest } from './utente-api';

@Component({
  selector: 'app-utenti',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './utenti.html',
})
export class Utenti implements OnInit {
  private readonly utenteApi = inject(UtenteApi);
  private readonly fb = inject(FormBuilder);

  protected readonly utenti = signal<Utente[]>([]);
  protected readonly caricando = signal(false);
  protected readonly errore = signal<string | null>(null);
  /** Id dell'utente in modifica, null quando il form serve a crearne uno nuovo. */
  protected readonly idInModifica = signal<number | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    nome: ['', Validators.required],
    cognome: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  ngOnInit(): void {
    this.carica();
  }

  protected carica(): void {
    this.caricando.set(true);
    this.errore.set(null);
    this.utenteApi.elenca().subscribe({
      next: (utenti) => {
        this.utenti.set(utenti);
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
    const id = this.idInModifica();
    this.errore.set(null);

    if (id === null) {
      const payload: UtenteRegistrazioneRequest = this.form.getRawValue();
      this.utenteApi.crea(payload).subscribe({
        next: () => {
          this.resetForm();
          this.carica();
        },
        error: (err: HttpErrorResponse) => this.errore.set(this.estraiMessaggio(err)),
      });
    } else {
      const { nome, cognome } = this.form.getRawValue();
      const payload: UtenteAggiornamentoRequest = { nome, cognome };
      this.utenteApi.aggiorna(id, payload).subscribe({
        next: () => {
          this.resetForm();
          this.carica();
        },
        error: (err: HttpErrorResponse) => this.errore.set(this.estraiMessaggio(err)),
      });
    }
  }

  protected modifica(utente: Utente): void {
    this.idInModifica.set(utente.id);
    this.form.controls.email.disable();
    this.form.controls.email.clearValidators();
    this.form.controls.email.updateValueAndValidity();
    this.form.controls.password.disable();
    this.form.controls.password.clearValidators();
    this.form.controls.password.updateValueAndValidity();
    this.form.patchValue({
      nome: utente.nome,
      cognome: utente.cognome,
      email: utente.email,
      password: '',
    });
  }

  protected annullaModifica(): void {
    this.resetForm();
  }

  protected disattiva(utente: Utente): void {
    this.errore.set(null);
    this.utenteApi.disattiva(utente.id).subscribe({
      next: () => this.carica(),
      error: (err: HttpErrorResponse) => this.errore.set(this.estraiMessaggio(err)),
    });
  }

  protected riattiva(utente: Utente): void {
    this.errore.set(null);
    this.utenteApi.riattiva(utente.id).subscribe({
      next: () => this.carica(),
      error: (err: HttpErrorResponse) => this.errore.set(this.estraiMessaggio(err)),
    });
  }

  protected elimina(utente: Utente): void {
    const confermato = confirm(
      `Eliminare definitivamente l'utente "${utente.nome} ${utente.cognome}"? L'operazione non è reversibile.`,
    );
    if (!confermato) {
      return;
    }
    this.errore.set(null);
    this.utenteApi.elimina(utente.id).subscribe({
      next: () => this.carica(),
      error: (err: HttpErrorResponse) => this.errore.set(this.estraiMessaggio(err)),
    });
  }

  private resetForm(): void {
    this.idInModifica.set(null);
    this.form.controls.email.enable();
    this.form.controls.email.setValidators([Validators.required, Validators.email]);
    this.form.controls.email.updateValueAndValidity();
    this.form.controls.password.enable();
    this.form.controls.password.setValidators([Validators.required, Validators.minLength(8)]);
    this.form.controls.password.updateValueAndValidity();
    this.form.reset({ nome: '', cognome: '', email: '', password: '' });
  }

  private estraiMessaggio(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Impossibile contattare il backend: controlla che sia avviato su localhost:8080.';
    }
    return err.error?.messaggio ?? `Errore ${err.status}: ${err.statusText}`;
  }
}
