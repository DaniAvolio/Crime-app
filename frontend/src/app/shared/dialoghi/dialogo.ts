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
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { DialoghiService, OpzioniRichiesta } from './dialoghi';

const SELETTORE_FOCALIZZABILI =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SOLO_NUMERI: ValidatorFn = Validators.pattern(/^-?\d+([.,]\d+)?$/);

/**
 * Unico modal dell'app, montato in app.html e pilotato da DialoghiService. Stile del dialog
 * Soccorsi: pannello dal basso su mobile, centrato su desktop.
 */
@Component({
  selector: 'app-dialogo',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoDirective, LucideDynamicIcon],
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
  /** Form del dialog "chiedi", ricostruito a ogni apertura dai campi richiesti. */
  protected readonly form = signal(new FormGroup<Record<string, FormControl<string>>>({}));

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
        this.form.set(this.creaForm(aperto.opzioni));
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
      const form = this.form();
      if (form.invalid) {
        form.markAllAsTouched();
        this.riquadro()?.nativeElement.querySelector<HTMLElement>('.ng-invalid')?.focus();
        return;
      }
      const valori = form.getRawValue();
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

  protected erroreCampo(nome: string): 'obbligatorio' | 'numero' | null {
    const controllo = this.form().controls[nome];
    if (!controllo?.touched || controllo.valid) {
      return null;
    }
    return controllo.hasError('required') ? 'obbligatorio' : 'numero';
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

  private creaForm(opzioni: OpzioniRichiesta): FormGroup<Record<string, FormControl<string>>> {
    return new FormGroup(
      Object.fromEntries(
        opzioni.campi.map((campo) => {
          const validatori: ValidatorFn[] = [];
          if (campo.obbligatorio) {
            validatori.push(Validators.required);
          }
          if (campo.tipo === 'number') {
            validatori.push(SOLO_NUMERI);
          }
          return [
            campo.nome,
            new FormControl(campo.valoreIniziale ?? '', {
              nonNullable: true,
              validators: validatori,
            }),
          ];
        }),
      ),
    );
  }
}
