import { Routes } from '@angular/router';
import { Home } from './home/home';
import { adminGuard, autenticatoGuard, ospiteGuard, paginaInizialeGuard } from './auth/auth.guard';

// Solo la home è nel bundle iniziale: le altre pagine si scaricano quando si aprono, così chi
// guarda solo home e mappa non scarica gestione, profilo e form di accesso.
export const routes: Routes = [
  // Ospiti: landing. Utenti autenticati: direttamente la mappa.
  { path: '', component: Home, canActivate: [paginaInizialeGuard] },
  // MapLibre GL è pesante e serve solo aprendo la mappa.
  // Pubblica: la consultazione non richiede login, solo pubblicare e votare (vedi Mappa).
  { path: 'mappa', loadComponent: () => import('./mappa/mappa').then((m) => m.Mappa) },
  {
    path: 'login',
    loadComponent: () => import('./auth/login').then((m) => m.Login),
    canActivate: [ospiteGuard],
  },
  {
    path: 'registrati',
    loadComponent: () => import('./auth/registrazione').then((m) => m.Registrazione),
    canActivate: [ospiteGuard],
  },
  {
    path: 'profilo',
    loadComponent: () => import('./profilo/profilo').then((m) => m.Profilo),
    canActivate: [autenticatoGuard],
  },
  {
    path: 'gestione',
    canActivate: [adminGuard],
    children: [
      { path: '', loadComponent: () => import('./gestione/gestione').then((m) => m.Gestione) },
      {
        path: 'categorie',
        loadComponent: () => import('./categorie/categorie').then((m) => m.Categorie),
      },
      {
        path: 'utenti',
        loadComponent: () => import('./gestione/utenti/utenti').then((m) => m.Utenti),
      },
      {
        path: 'segnalazioni',
        loadComponent: () =>
          import('./gestione/segnalazioni/segnalazioni').then((m) => m.Segnalazioni),
      },
    ],
  },
];
