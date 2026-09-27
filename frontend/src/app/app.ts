import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Nav } from './shared/nav';
import { Dialogo } from './shared/dialoghi/dialogo';
import { ContenitoreToast } from './shared/toast/contenitore-toast';

@Component({
  imports: [RouterOutlet, Nav, Dialogo, ContenitoreToast],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('frontend');
}
