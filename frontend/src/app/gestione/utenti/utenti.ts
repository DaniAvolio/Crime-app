import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { RuoloUtente, Utente } from '../../models/utente.model';
import { AuthService } from '../../auth/auth';
import {
  FiltriGestioneUtenti,
  UtenteAggiornamentoRequest,
  UtenteApi,
  UtenteRegistrazioneRequest,
} from './utente-api';
import { IntestazioneOrdinabile } from '../../shared/tabella/intestazione-ordinabile';
import { IndicatoreCaricamento } from '../../shared/tabella/indicatore-caricamento';
import { Paginazione } from '../../shared/tabella/paginazione';
import { TabellaRemota } from '../../shared/tabella/tabella';
import { DialoghiService } from '../../shared/dialoghi/dialoghi';
import { ToastService } from '../../shared/toast/toast';

@Component({
  selector: 'app-utenti',
  standalone: true,
  imports: [ReactiveFormsModule, IntestazioneOrdinabile, Paginazione, IndicatoreCaricamento],
  templateUrl: './utenti.html',
})
export class Utenti {
  private readonly utenteApi = inject(UtenteApi);
  private readonly fb = inject(FormBuilder);
  private readonly dialoghi = inject(DialoghiService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly errore = signal<string | null>(null);

  /** Paginata, filtrata e ordinata dal backend; di default per cognome e nome. */
  protected readonly tabella = new TabellaRemota<FiltriGestioneUtenti, Utente>(
    (richiesta) => this.utenteApi.pagina(richiesta),
    {
      nome: '',
      cognome: '',
      email: '',
      identitaVerificata: '',
      fiduciaMin: '',
      fiduciaMax: '',
      attivo: '',
      ruolo: '',
    },
    { campo: 'cognome', direzione: 'asc' },
  );
  protected readonly erroreTabella = computed(() => {
    const err = this.tabella.errore();
    return err ? this.estraiMessaggio(err) : null;
  });
  /** Id dell'utente in modifica, null quando il form serve a crearne uno nuovo. */
  protected readonly idInModifica = signal<number | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    nome: ['', Validators.required],
    cognome: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

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
          this.tabella.aggiorna();
        },
        error: (err: HttpErrorResponse) => this.errore.set(this.estraiMessaggio(err)),
      });
    } else {
      const { nome, cognome } = this.form.getRawValue();
      const payload: UtenteAggiornamentoRequest = { nome, cognome };
      this.utenteApi.aggiorna(id, payload).subscribe({
        next: () => {
          this.resetForm();
          this.tabella.aggiorna();
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
      next: () => this.tabella.aggiorna(),
      error: (err: HttpErrorResponse) => this.errore.set(this.estraiMessaggio(err)),
    });
  }

  protected riattiva(utente: Utente): void {
    this.errore.set(null);
    this.utenteApi.riattiva(utente.id).subscribe({
      next: () => this.tabella.aggiorna(),
      error: (err: HttpErrorResponse) => this.errore.set(this.estraiMessaggio(err)),
    });
  }

  /**
   * Il backend rifiuta (409) la revoca dell'ultimo admin attivo. Se un admin revoca
   * sé stesso, il backend lo tratta subito da utente: si esce per riallineare la sessione.
   */
  protected async cambiaRuolo(utente: Utente, ruolo: RuoloUtente): Promise<void> {
    const nome = `${utente.nome} ${utente.cognome}`;
    const promozione = ruolo === 'ADMIN';
    const sestesso = utente.id === this.auth.utente()?.id;
    const confermato = await this.dialoghi.conferma({
      titolo: promozione ? 'Rendere amministratore?' : 'Rimuovere il ruolo di amministratore?',
      messaggio: promozione
        ? `${nome} potrà gestire utenti, categorie e moderazione.`
        : sestesso
          ? 'Perderai subito l’accesso alla gestione e dovrai accedere di nuovo.'
          : `${nome} non potrà più accedere alla gestione.`,
      conferma: promozione ? 'Rendi admin' : 'Rimuovi admin',
      pericolo: !promozione,
    });
    if (!confermato) {
      return;
    }
    this.errore.set(null);
    this.utenteApi.cambiaRuolo(utente.id, ruolo).subscribe({
      next: () => {
        if (sestesso && !promozione) {
          this.auth.logout();
          this.toast.info('Non sei più amministratore: accedi di nuovo.');
          void this.router.navigateByUrl('/login');
          return;
        }
        this.toast.successo(
          promozione ? `${nome} ora è amministratore.` : `${nome} non è più amministratore.`,
        );
        this.tabella.aggiorna();
      },
      error: (err: HttpErrorResponse) => {
        this.errore.set(this.estraiMessaggio(err));
        this.toast.errore('Non siamo riusciti a cambiare il ruolo.');
      },
    });
  }

  protected async elimina(utente: Utente): Promise<void> {
    const nome = `${utente.nome} ${utente.cognome}`;
    const confermato = await this.dialoghi.conferma({
      titolo: "Eliminare l'utente?",
      messaggio: `${nome} verrà eliminato definitivamente. L'operazione non è reversibile.`,
      conferma: 'Elimina',
      pericolo: true,
    });
    if (!confermato) {
      return;
    }
    this.errore.set(null);
    this.utenteApi.elimina(utente.id).subscribe({
      next: () => {
        this.toast.successo(`Utente ${nome} eliminato.`);
        this.tabella.aggiorna();
      },
      error: (err: HttpErrorResponse) => {
        this.errore.set(this.estraiMessaggio(err));
        this.toast.errore("Non siamo riusciti a eliminare l'utente.");
      },
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
