import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Mappa } from './mappa/mappa';
import { Categorie } from './categorie/categorie';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'mappa', component: Mappa },
  { path: 'categorie', component: Categorie },
];
