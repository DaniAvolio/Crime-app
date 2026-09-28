import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';

/** Lingua attiva di Transloco come signal, per i `computed` che devono aggiornarsi al cambio lingua. */
@Injectable({ providedIn: 'root' })
export class LinguaService {
  private readonly transloco = inject(TranslocoService);

  readonly attiva = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
}
