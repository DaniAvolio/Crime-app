import {
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { SegnalazioneApi } from '../gestione/segnalazioni/segnalazione-api';
import { MOTIVI_ABUSO, MotivoAbuso } from '../models/segnalazione-abuso.model';

const LUNGHEZZA_MASSIMA_NOTA = 300;

/**
 * "Segnala un problema" su una segnalazione altrui, dentro il pannello di dettaglio della mappa:
 * un motivo tra quelli previsti e una nota facoltativa. Il backend accetta un solo invio per
 * utente e solo su segnalazioni ancora attive: un 409 copre entrambi i casi.
 */
@Component({
  selector: 'app-segnala-abuso',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoDirective, LucideDynamicIcon],
  templateUrl: './segnala-abuso.html',
})
export class SegnalaAbuso {
  readonly segnalazioneId = input.required<number>();
  /** Inviato (o già inviato in precedenza): la pagina segna la segnalazione e avvisa l'utente. */
  readonly inviato = output<void>();
  readonly annulla = output<void>();

  private readonly segnalazioneApi = inject(SegnalazioneApi);

  protected readonly motivi = MOTIVI_ABUSO;
  protected readonly lunghezzaMassimaNota = LUNGHEZZA_MASSIMA_NOTA;
  protected readonly invio = signal(false);
  /** Errore generico o 409: già segnalato da questo utente, oppure segnalazione non più attiva. */
  protected readonly errore = signal<'generico' | 'nonDisponibile' | null>(null);

  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly form = this.fb.group({
    motivo: this.fb.control<MotivoAbuso | ''>('', Validators.required),
    nota: ['', Validators.maxLength(LUNGHEZZA_MASSIMA_NOTA)],
  });

  private readonly primoMotivo = viewChild<ElementRef<HTMLInputElement>>('primoMotivo');

  constructor() {
    // Il pannello si apre su richiesta: il fuoco va sulla prima scelta, per la tastiera.
    afterNextRender(() => this.primoMotivo()?.nativeElement.focus());
  }

  protected invia(): void {
    if (this.form.invalid || this.invio()) {
      this.form.markAllAsTouched();
      return;
    }
    const { motivo, nota } = this.form.getRawValue();
    this.invio.set(true);
    this.errore.set(null);
    this.segnalazioneApi
      .segnalaAbuso(this.segnalazioneId(), {
        motivo: motivo as MotivoAbuso,
        nota: nota.trim() === '' ? null : nota.trim(),
      })
      .subscribe({
        next: () => {
          this.invio.set(false);
          this.inviato.emit();
        },
        error: (err: HttpErrorResponse) => {
          this.invio.set(false);
          this.errore.set(err.status === 409 ? 'nonDisponibile' : 'generico');
        },
      });
  }
}
