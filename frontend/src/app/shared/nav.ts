import { NgClass } from '@angular/common';
import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TemaService } from './tema';
import { ThemeToggle } from './theme-toggle';

/**
 * Nav bar globale, montata una sola volta in app.html: ospita i link di navigazione e il
 * pannello impostazioni (lingua + tema), cosi ogni pagina futura li eredita senza dover
 * reimplementare switch lingua/tema al proprio interno.
 */
@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    TranslocoDirective,
    LucideDynamicIcon,
    ThemeToggle,
    NgClass,
  ],
  templateUrl: './nav.html',
})
export class Nav {
  private readonly transloco = inject(TranslocoService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  /**
   * Iniettato qui (Nav è sempre montata in app.html) solo per forzare la costruzione
   * eager di TemaService: essendo `providedIn: 'root'`, altrimenti resterebbe istanziato
   * pigramente al primo utilizzo di <app-theme-toggle>, che vive dentro il pannello
   * impostazioni chiuso di default, e il tema si applicherebbe solo al primo click.
   */
  private readonly tema = inject(TemaService);

  protected readonly pannelloAperto = signal(false);
  protected readonly linguaAttiva = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected toggleImpostazioni(): void {
    this.pannelloAperto.update((aperto) => !aperto);
  }

  protected impostaLingua(lingua: string): void {
    this.transloco.setActiveLang(lingua);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.pannelloAperto()) {
      return;
    }
    const dentroLaNav = this.elementRef.nativeElement.contains(event.target as Node);
    if (!dentroLaNav) {
      this.pannelloAperto.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.pannelloAperto.set(false);
  }
}
