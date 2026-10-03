import {
  ApplicationConfig,
  ErrorHandler,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideLucideIcons } from '@lucide/angular';
import { provideTransloco } from '@jsverse/transloco';
import { routes } from './app.routes';
import { ICONE_CATEGORIA_DISPONIBILI } from './shared/icone-categoria';
import { TranslocoHttpLoader } from './transloco-loader';
import { LoggerErrorHandler } from './shared/logger-error-handler';
import { httpLoggingInterceptor } from './shared/http-logging.interceptor';
import { authInterceptor } from './auth/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: LoggerErrorHandler },
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, httpLoggingInterceptor])),
    // Service worker (solo build di produzione): app installabile e notifiche push. Non mette in
    // cache le API (vedi ngsw-config.json): i dati arrivano sempre freschi dal backend.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideLucideIcons(...ICONE_CATEGORIA_DISPONIBILI),
    provideTransloco({
      config: {
        availableLangs: ['it', 'en'],
        defaultLang: 'it',
        fallbackLang: 'it',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
  ],
};
