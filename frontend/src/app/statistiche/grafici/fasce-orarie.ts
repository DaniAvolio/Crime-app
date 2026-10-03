import { Component, computed, inject, input, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LinguaService } from '../../shared/lingua';
import { TemaService } from '../../shared/tema';
import { RAMPA, coloreIntensita } from '../rampa';
import { FasciaOraria } from '../statistiche-api';
import { larghezzaHost } from './larghezza';

const GIORNI = [1, 2, 3, 4, 5, 6, 7];
const ORE = Array.from({ length: 24 }, (_, ora) => ora);
const COLONNA_GIORNI = 36;
const SPAZIO = 2;
const LATO_MASSIMO = 22;
/** Un lunedì qualsiasi: serve solo a farsi dare da Intl i nomi dei giorni nella lingua attiva. */
const LUNEDI = new Date(2024, 0, 1);

/**
 * Quando succede: griglia giorno della settimana × ora, colore = numero di segnalazioni
 * (scala sequenziale a una tinta, zero in grigio neutro). Tooltip al passaggio, legenda
 * "meno → più" e vista a tabella con le fasce non vuote.
 */
@Component({
  selector: 'app-grafico-fasce-orarie',
  standalone: true,
  imports: [TranslocoDirective],
  host: { class: 'relative block' },
  template: `
    <ng-container *transloco="let t">
      <svg
        [attr.width]="larghezza()"
        [attr.height]="altezza()"
        role="img"
        [attr.aria-label]="titolo()"
        class="block"
        (pointerleave)="attiva.set(null)"
      >
        @for (ora of ore; track ora) {
          @if (ora % 3 === 0) {
            <text
              [attr.x]="x(ora) + lato() / 2"
              y="10"
              text-anchor="middle"
              class="fill-gray-500 text-[10px] tabular-nums dark:fill-muted"
            >
              {{ ora }}
            </text>
          }
        }
        @for (giorno of giorni; track giorno) {
          <text
            [attr.x]="0"
            [attr.y]="y(giorno) + lato() / 2"
            dominant-baseline="middle"
            class="fill-gray-500 text-[11px] dark:fill-muted"
          >
            {{ nomeGiorno(giorno, 'short') }}
          </text>
          @for (ora of ore; track ora) {
            <rect
              [attr.x]="x(ora)"
              [attr.y]="y(giorno)"
              [attr.width]="lato()"
              [attr.height]="lato()"
              rx="2"
              [attr.fill]="colore(giorno, ora)"
              [attr.stroke]="cellaAttiva(giorno, ora) ? 'currentColor' : 'none'"
              stroke-width="1.5"
              class="text-gray-900 dark:text-paper"
              (pointerenter)="attiva.set({ giorno, ora })"
            />
          }
        }
      </svg>

      @if (dettaglio(); as d) {
        <div
          class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md dark:border-line dark:bg-panel"
          [style.left.px]="d.x"
          [style.top.px]="d.y - 4"
        >
          <span class="block text-sm font-semibold text-gray-900 tabular-nums dark:text-paper">{{
            d.numero
          }}</span>
          <span class="text-gray-500 dark:text-muted">{{ d.etichetta }}</span>
        </div>
      }

      <div class="mt-2 flex items-center gap-1.5 text-xs text-gray-500 dark:text-muted">
        {{ t('statistiche.meno') }}
        @for (passo of rampa(); track passo) {
          <span class="h-2.5 w-4 rounded-sm" [style.background]="passo"></span>
        }
        {{ t('statistiche.piu') }}
      </div>

      <details class="mt-2 text-sm">
        <summary class="cursor-pointer text-gray-500 dark:text-muted">
          {{ t('statistiche.tabella') }}
        </summary>
        <table class="mt-2 w-full text-left text-sm tabular-nums">
          <thead>
            <tr class="text-gray-500 dark:text-muted">
              <th class="py-1 font-medium">{{ t('statistiche.fascia') }}</th>
              <th class="py-1 text-right font-medium">{{ t('statistiche.segnalazioni') }}</th>
            </tr>
          </thead>
          <tbody>
            @for (fascia of fasceOrdinate(); track fascia.giornoSettimana * 100 + fascia.ora) {
              <tr class="border-t border-gray-100 dark:border-line">
                <td class="py-1">{{ etichettaFascia(fascia.giornoSettimana, fascia.ora) }}</td>
                <td class="py-1 text-right">{{ fascia.numero }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="2" class="py-1 text-gray-500 dark:text-muted">—</td>
              </tr>
            }
          </tbody>
        </table>
      </details>
    </ng-container>
  `,
})
export class GraficoFasceOrarie {
  readonly fasce = input.required<FasciaOraria[]>();
  readonly titolo = input.required<string>();

  private readonly lingua = inject(LinguaService);
  private readonly tema = inject(TemaService);

  protected readonly larghezza = larghezzaHost();
  protected readonly giorni = GIORNI;
  protected readonly ore = ORE;
  protected readonly attiva = signal<{ giorno: number; ora: number } | null>(null);

  private readonly conteggi = computed(() => {
    const mappa = new Map<number, number>();
    for (const f of this.fasce()) {
      mappa.set(f.giornoSettimana * 100 + f.ora, f.numero);
    }
    return mappa;
  });
  private readonly massimo = computed(() => Math.max(0, ...this.fasce().map((f) => f.numero)));

  protected readonly lato = computed(() =>
    Math.max(
      6,
      Math.min(LATO_MASSIMO, Math.floor((this.larghezza() - COLONNA_GIORNI) / 24) - SPAZIO),
    ),
  );
  protected readonly altezza = computed(() => 16 + 7 * (this.lato() + SPAZIO));
  protected readonly rampa = computed(() => RAMPA[this.tema.temaAttuale()]);

  protected readonly fasceOrdinate = computed(() =>
    [...this.fasce()].sort((a, b) => b.numero - a.numero),
  );

  protected readonly dettaglio = computed(() => {
    const a = this.attiva();
    if (!a) {
      return null;
    }
    return {
      x: this.x(a.ora) + this.lato() / 2,
      y: this.y(a.giorno),
      numero: this.numero(a.giorno, a.ora),
      etichetta: this.etichettaFascia(a.giorno, a.ora),
    };
  });

  protected x(ora: number): number {
    return COLONNA_GIORNI + ora * (this.lato() + SPAZIO);
  }

  protected y(giorno: number): number {
    return 16 + (giorno - 1) * (this.lato() + SPAZIO);
  }

  private numero(giorno: number, ora: number): number {
    return this.conteggi().get(giorno * 100 + ora) ?? 0;
  }

  protected colore(giorno: number, ora: number): string {
    return coloreIntensita(this.numero(giorno, ora), this.massimo(), this.tema.temaAttuale());
  }

  protected cellaAttiva(giorno: number, ora: number): boolean {
    const a = this.attiva();
    return a !== null && a.giorno === giorno && a.ora === ora;
  }

  protected nomeGiorno(giorno: number, formato: 'short' | 'long'): string {
    const data = new Date(LUNEDI.getTime() + (giorno - 1) * 86_400_000);
    return new Intl.DateTimeFormat(this.lingua.attiva(), { weekday: formato }).format(data);
  }

  protected etichettaFascia(giorno: number, ora: number): string {
    const due = (n: number) => String(n).padStart(2, '0');
    return `${this.nomeGiorno(giorno, 'long')} ${due(ora)}:00–${due((ora + 1) % 24)}:00`;
  }
}
