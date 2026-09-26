import type { LivelloLog } from '../app/shared/logger';

export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
  logLevel: 'debug' as LivelloLog,
};
