import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideLucideIcons } from '@lucide/angular';
import { routes } from './app.routes';
import { ICONE_CATEGORIA_DISPONIBILI } from './shared/icone-categoria';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideLucideIcons(...ICONE_CATEGORIA_DISPONIBILI),
  ]
};
