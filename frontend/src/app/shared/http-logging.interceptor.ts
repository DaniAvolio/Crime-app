import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { LoggerService } from './logger';

/**
 * Logga le chiamate HTTP fallite: warn per gli errori del client (4xx), error per
 * backend irraggiungibile (status 0) o errori del server (5xx). L'errore viene poi
 * propagato invariato al chiamante.
 */
export const httpLoggingInterceptor: HttpInterceptorFn = (req, next) => {
  const log = inject(LoggerService);
  return next(req).pipe(
    tap({
      error: (errore: unknown) => {
        if (!(errore instanceof HttpErrorResponse)) {
          return;
        }
        const descrizione = `${req.method} ${req.urlWithParams} -> ${errore.status}`;
        if (errore.status >= 400 && errore.status < 500) {
          log.warn(descrizione, errore.error);
        } else {
          log.error(descrizione, errore.error ?? errore.message);
        }
      },
    }),
  );
};
