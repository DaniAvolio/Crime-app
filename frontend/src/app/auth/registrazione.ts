import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AuthService } from './auth';
import { destinazioneSicura, messaggioErrore } from './login';

/** Lunghezza minima imposta anche dal backend (UtenteRegistrazioneRequest). */
const LUNGHEZZA_MINIMA_PASSWORD = 8;

@Component({
  selector: 'app-registrazione',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './registrazione.html',
})
export class Registrazione {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  protected readonly redirect = destinazioneSicura(
    inject(ActivatedRoute).snapshot.queryParamMap.get('redirect'),
  );
  protected readonly invio = signal(false);
  protected readonly errore = signal<string | null>(null);
  protected readonly lunghezzaMinimaPassword = LUNGHEZZA_MINIMA_PASSWORD;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    nome: ['', Validators.required],
    cognome: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(LUNGHEZZA_MINIMA_PASSWORD)]],
  });

  /** Il backend autentica subito il nuovo utente: si prosegue come dopo un login. */
  protected registrati(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { nome, cognome, email, password } = this.form.getRawValue();
    this.invio.set(true);
    this.errore.set(null);
    this.auth
      .registrazione({ nome: nome.trim(), cognome: cognome.trim(), email: email.trim(), password })
      .subscribe({
        next: () => void this.router.navigateByUrl(this.redirect),
        error: (err: HttpErrorResponse) => {
          this.invio.set(false);
          this.errore.set(messaggioErrore(err, this.transloco));
        },
      });
  }
}
