import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { CampoDialogo, DialoghiService } from './dialoghi';

const SELETTORE_FOCALIZZABILI =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SOLO_NUMERI = /^-?\d+([.,]\d+)?$/;

/**
 * Unico modal dell'app, montato in app.html e pilotato da DialoghiService. Stile del dialog
 * Soccorsi: pannello dal basso su mobile, centrato su desktop.
 * I campi di "chiedi" sono input semplici con valori in un signal, senza @angular/forms: il
 * dialog è sempre caricato e i form reattivi aggiungerebbero ~60 kB al bundle iniziale.
 */
@Component({
  selector: 'app-dialogo',
  standalone: true,
  imports: [TranslocoDirective, LucideDynamicIcon],
  templateUrl: './dialogo.html',
  host: { '(document:keydown.escape)': 'annulla()' },
})
export class Dialogo {
  protected readonly dialoghi = inject(DialoghiService);
  protected readonly aperto = this.dialoghi.dialogoAperto;
  protected readonly opzioni = computed(() => this.aperto()?.opzioni ?? null);
  protected readonly campi = computed(() => {
    const aperto = this.aperto();
    return aperto?.tipo === 'chiedi' ? aperto.opzioni.campi : [];
  });
  /** Valori dei campi del dialog "chiedi", azzerati a ogni apertura. */
  protected readonly valori = signal<Record<string, string>>({});
  /** Campi già lasciati (o tutti, dopo un invio): solo questi mostrano l'errore. */
  private readonly toccati = signal<ReadonlySet<string>>(new Set());

  private readonly riquadro = viewChild<ElementRef<HTMLElement>>('riquadro');
  private readonly injector = inject(Injector);
  /** Elemento che aveva il focus prima dell'apertura: lo riceve di nuovo alla chiusura. */
  private focusPrecedente: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const aperto = this.aperto();
      if (!aperto) {
        this.focusPrecedente?.focus();
        this.focusPrecedente = null;
        return;
      }
      this.focusPrecedente ??= document.activeElement as HTMLElement | null;
      if (aperto.tipo === 'chiedi') {
        this.valori.set(
          Object.fromEntries(aperto.opzioni.campi.map((c) => [c.nome, c.valoreIniziale ?? ''])),
        );
        this.toccati.set(new Set());
      }
      afterNextRender(() => this.focusIniziale(), { injector: this.injector });
    });
  }

  protected conferma(): void {
    const aperto = this.aperto();
    if (aperto?.tipo === 'conferma') {
      aperto.chiudi(true);
      return;
    }
    if (aperto?.tipo === 'chiedi') {
      if (aperto.opzioni.campi.some((campo) => this.errore(campo) !== null)) {
        this.toccati.set(new Set(aperto.opzioni.campi.map((campo) => campo.nome)));
        afterNextRender(
          () =>
            this.riquadro()
              ?.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')
              ?.focus(),
          { injector: this.injector },
        );
        return;
      }
      const valori = this.valori();
      aperto.chiudi(
        Object.fromEntries(Object.entries(valori).map(([nome, valore]) => [nome, valore.trim()])),
      );
    }
  }

  protected annulla(): void {
    const aperto = this.aperto();
    if (aperto?.tipo === 'conferma') {
      aperto.chiudi(false);
    } else if (aperto?.tipo === 'chiedi') {
      aperto.chiudi(null);
    }
  }

  protected aggiorna(nome: string, valore: string): void {
    this.valori.update((valori) => ({ ...valori, [nome]: valore }));
  }

  protected tocca(nome: string): void {
    this.toccati.update((toccati) => new Set(toccati).add(nome));
  }

  /** Errore da mostrare sotto il campo: solo dopo che l'utente l'ha lasciato o ha inviato. */
  protected erroreCampo(campo: CampoDialogo): 'obbligatorio' | 'numero' | null {
    return this.toccati().has(campo.nome) ? this.errore(campo) : null;
  }

  private errore(campo: CampoDialogo): 'obbligatorio' | 'numero' | null {
    const valore = (this.valori()[campo.nome] ?? '').trim();
    if (valore === '') {
      return campo.obbligatorio ? 'obbligatorio' : null;
    }
    return campo.tipo === 'number' && !SOLO_NUMERI.test(valore) ? 'numero' : null;
  }

  /** Tab e Maiusc+Tab restano dentro il dialog finché è aperto. */
  protected intrappolaFocus(evento: KeyboardEvent): void {
    if (evento.key !== 'Tab') {
      return;
    }
    const focalizzabili = [
      ...(this.riquadro()?.nativeElement.querySelectorAll<HTMLElement>(SELETTORE_FOCALIZZABILI) ??
        []),
    ];
    if (focalizzabili.length === 0) {
      return;
    }
    const primo = focalizzabili[0];
    const ultimo = focalizzabili[focalizzabili.length - 1];
    if (evento.shiftKey && document.activeElement === primo) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primo.focus();
    }
  }

  /**
   * Primo campo per "chiedi"; per le conferme il bottone sicuro: "Annulla" se l'azione è
   * distruttiva (un Invio di troppo non deve eliminare nulla), altrimenti quello di conferma.
   */
  private focusIniziale(): void {
    const riquadro = this.riquadro()?.nativeElement;
    const aperto = this.aperto();
    if (!riquadro || !aperto) {
      return;
    }
    const selettore =
      aperto.tipo === 'chiedi'
        ? 'input, textarea'
        : aperto.opzioni.pericolo
          ? '[data-dialogo="annulla"]'
          : '[data-dialogo="conferma"]';
    riquadro.querySelector<HTMLElement>(selettore)?.focus();
  }
}
