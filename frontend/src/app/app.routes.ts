import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Mappa } from './mappa/mappa';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'mappa', component: Mappa },
];
