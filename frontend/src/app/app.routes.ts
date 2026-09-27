import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Categorie } from './categorie/categorie';
import { Gestione } from './gestione/gestione';
import { Utenti } from './gestione/utenti/utenti';
import { Segnalazioni } from './gestione/segnalazioni/segnalazioni';
import { Login } from './auth/login';
import { Registrazione } from './auth/registrazione';
import { adminGuard, ospiteGuard, paginaInizialeGuard } from './auth/auth.guard';

export const routes: Routes = [
  // Ospiti: landing. Utenti autenticati: direttamente la mappa.
  { path: '', component: Home, canActivate: [paginaInizialeGuard] },
  // Lazy: MapLibre GL è pesante e serve solo aprendo la mappa.
  // Pubblica: la consultazione non richiede login, solo pubblicare e votare (vedi Mappa).
  { path: 'mappa', loadComponent: () => import('./mappa/mappa').then((m) => m.Mappa) },
  { path: 'login', component: Login, canActivate: [ospiteGuard] },
  { path: 'registrati', component: Registrazione, canActivate: [ospiteGuard] },
  {
    path: 'gestione',
    canActivate: [adminGuard],
    children: [
      { path: '', component: Gestione },
      { path: 'categorie', component: Categorie },
      { path: 'utenti', component: Utenti },
      { path: 'segnalazioni', component: Segnalazioni },
    ],
  },
];
