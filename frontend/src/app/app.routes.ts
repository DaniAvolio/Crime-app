import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Mappa } from './mappa/mappa';
import { Categorie } from './categorie/categorie';
import { Gestione } from './gestione/gestione';
import { Utenti } from './gestione/utenti/utenti';
import { Segnalazioni } from './gestione/segnalazioni/segnalazioni';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'mappa', component: Mappa },
  { path: 'gestione', component: Gestione },
  { path: 'gestione/categorie', component: Categorie },
  { path: 'gestione/utenti', component: Utenti },
  { path: 'gestione/segnalazioni', component: Segnalazioni },
];
