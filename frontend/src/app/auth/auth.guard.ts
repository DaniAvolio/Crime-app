import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { ToastService } from '../shared/toast/toast';
import { AuthService } from './auth';

/** Pagine che richiedono login: senza sessione si va al login, che poi riporta qui. */
export const autenticatoGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.autenticato()) {
    return true;
  }
  return inject(Router).createUrlTree(['/login'], { queryParams: { redirect: state.url } });
};

/** Area gestione: riservata agli ADMIN (il backend lo verifica comunque su ogni endpoint). */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.autenticato()) {
    return router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
  }
  if (auth.isAdmin()) {
    return true;
  }
  inject(ToastService).errore(inject(TranslocoService).translate('auth.soloAdmin'));
  return router.createUrlTree(['/']);
};

/** Login e registrazione non hanno senso se si è già autenticati. */
export const ospiteGuard: CanActivateFn = () => {
  return inject(AuthService).autenticato() ? inject(Router).createUrlTree(['/']) : true;
};
