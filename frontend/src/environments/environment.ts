import type { LivelloLog } from '../app/shared/logger';

export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
  /** Temporaneo, finché non c'è autenticazione: utente per cui votare "è ancora in atto?" dalla mappa. */
  utenteCorrenteId: 1,
  logLevel: 'debug' as LivelloLog,
};
