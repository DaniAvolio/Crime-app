import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ToastService } from '../shared/toast/toast';
import { AuthService } from './auth';

/**
 * Aggiunge "Authorization: Bearer <token>" alle chiamate verso il backend. Se il backend
 * risponde 401 a una richiesta partita con un token, la sessione non è più valida
 * (scaduta o utente disattivato): si fa logout e si torna al login, ricordando la pagina.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);
  const transloco = inject(TranslocoService);

  const token = auth.token();
  const versoApi = req.url.startsWith(environment.apiUrl);
  const richiesta =
    token && versoApi ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(richiesta).pipe(
    catchError((errore: unknown) => {
      if (token && versoApi && errore instanceof HttpErrorResponse && errore.status === 401) {
        auth.logout();
        toast.info(transloco.translate('auth.sessioneScaduta'));
        void router.navigate(['/login'], { queryParams: { redirect: router.url } });
      }
      return throwError(() => errore);
    }),
  );
};
