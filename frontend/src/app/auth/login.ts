import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AuthService } from './auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  /** Pagina da cui si è arrivati (guard o interceptor), passata anche alla registrazione. */
  protected readonly redirect = destinazioneSicura(
    inject(ActivatedRoute).snapshot.queryParamMap.get('redirect'),
  );
  protected readonly invio = signal(false);
  protected readonly errore = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected accedi(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.invio.set(true);
    this.errore.set(null);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => void this.router.navigateByUrl(this.redirect),
      error: (err: HttpErrorResponse) => {
        this.invio.set(false);
        this.errore.set(messaggioErrore(err, this.transloco));
      },
    });
  }
}

/** Accetta solo percorsi interni all'app, per non trasformare ?redirect= in un open redirect. */
export function destinazioneSicura(redirect: string | null): string {
  return redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/mappa';
}

/** Il messaggio del backend (es. "Email o password non validi"), o uno generico se manca. */
export function messaggioErrore(err: HttpErrorResponse, transloco: TranslocoService): string {
  if (err.status === 0) {
    return transloco.translate('auth.errori.rete');
  }
  return err.error?.messaggio ?? transloco.translate('auth.errori.generico');
}
