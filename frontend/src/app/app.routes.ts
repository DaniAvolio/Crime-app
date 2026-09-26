import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Categorie } from './categorie/categorie';
import { Gestione } from './gestione/gestione';
import { Utenti } from './gestione/utenti/utenti';
import { Segnalazioni } from './gestione/segnalazioni/segnalazioni';

export const routes: Routes = [
  { path: '', component: Home },
  // Lazy: MapLibre GL è pesante e serve solo aprendo la mappa.
  { path: 'mappa', loadComponent: () => import('./mappa/mappa').then((m) => m.Mappa) },
  { path: 'gestione', component: Gestione },
  { path: 'gestione/categorie', component: Categorie },
  { path: 'gestione/utenti', component: Utenti },
  { path: 'gestione/segnalazioni', component: Segnalazioni },
];
