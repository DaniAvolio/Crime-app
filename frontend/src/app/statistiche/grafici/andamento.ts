import { Component, computed, inject, input, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LinguaService } from '../../shared/lingua';
import { TemaService } from '../../shared/tema';
import { COLORE_SERIE } from '../rampa';
import { GranularitaAndamento, PuntoAndamento } from '../statistiche-api';
import { larghezzaHost, scalaTonda } from './larghezza';

const ALTEZZA = 180;
const MARGINE = { sopra: 12, sotto: 26, sinistra: 34, destra: 4 };
const SPESSORE_MASSIMO = 24;
const RAGGIO = 4;
const SPAZIO_ETICHETTA_PX = 56;

/** Colonna con estremità arrotondata e base quadrata (sulla linea dello zero). */
function percorsoColonna(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RAGGIO, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Andamento delle segnalazioni nel tempo: una serie sola (niente legenda, il titolo dice cosa
 * è), colonne per giorno/settimana/mese con tooltip al passaggio e una vista a tabella.
 */
@Component({
  selector: 'app-grafico-andamento',
  standalone: true,
  imports: [TranslocoDirective],
  host: { class: 'relative block' },
  template: `
    <ng-container *transloco="let t">
      <svg
        [attr.width]="larghezza()"
        [attr.height]="altezza"
        role="img"
        [attr.aria-label]="riassunto()"
        class="block overflow-visible"
        (pointerleave)="attiva.set(null)"
      >
        @for (tacca of tacche(); track tacca.valore) {
          <line
            [attr.x1]="margine.sinistra"
            [attr.x2]="larghezza() - margine.destra"
            [attr.y1]="tacca.y"
            [attr.y2]="tacca.y"
            class="stroke-gray-200 dark:stroke-line"
            stroke-width="1"
          />
          <text
            [attr.x]="margine.sinistra - 6"
            [attr.y]="tacca.y"
            text-anchor="end"
            dominant-baseline="middle"
            class="fill-gray-500 text-[11px] tabular-nums dark:fill-muted"
          >
            {{ formattaNumero(tacca.valore) }}
          </text>
        }
        @for (colonna of colonne(); track colonna.punto.periodo; let i = $index) {
          @if (colonna.h > 0) {
            <path
              [attr.d]="colonna.d"
              [attr.fill]="colore()"
              [attr.opacity]="attiva() === null || attiva() === i ? 1 : 0.55"
            />
          }
          <!-- Area di tocco: tutta l'altezza della fascia, più grande della colonna. -->
          <rect
            [attr.x]="colonna.fascia.x"
            [attr.y]="margine.sopra"
            [attr.width]="colonna.fascia.w"
            [attr.height]="altezzaUtile()"
            fill="transparent"
            (pointerenter)="attiva.set(i)"
          />
          @if (colonna.etichetta) {
            <text
              [attr.x]="colonna.centro"
              [attr.y]="altezza - 8"
              text-anchor="middle"
              class="fill-gray-500 text-[11px] dark:fill-muted"
            >
              {{ colonna.etichetta }}
            </text>
          }
        }
      </svg>
      @if (dettaglio(); as d) {
        <div
          class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-md dark:border-line dark:bg-panel"
          [style.left.px]="d.x"
          [style.top.px]="d.y - 6"
        >
          <span class="block text-sm font-semibold text-gray-900 tabular-nums dark:text-paper">{{
            formattaNumero(d.numero)
          }}</span>
          <span class="text-gray-500 dark:text-muted">{{ d.etichetta }}</span>
        </div>
      }
      <details class="mt-2 text-sm">
        <summary class="cursor-pointer text-gray-500 dark:text-muted">
          {{ t('statistiche.tabella') }}
        </summary>
        <table class="mt-2 w-full text-left text-sm tabular-nums">
          <thead>
            <tr class="text-gray-500 dark:text-muted">
              <th class="py-1 font-medium">{{ t('statistiche.periodo') }}</th>
              <th class="py-1 text-right font-medium">{{ t('statistiche.segnalazioni') }}</th>
            </tr>
          </thead>
          <tbody>
            @for (colonna of colonne(); track colonna.punto.periodo) {
              <tr class="border-t border-gray-100 dark:border-line">
                <td class="py-1">{{ colonna.etichettaEstesa }}</td>
                <td class="py-1 text-right">{{ formattaNumero(colonna.punto.numero) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </details>
    </ng-container>
  `,
})
export class GraficoAndamento {
  readonly punti = input.required<PuntoAndamento[]>();
  readonly granularita = input.required<GranularitaAndamento>();
  /** Testo accessibile del grafico, già tradotto dalla pagina (es. "Segnalazioni per giorno"). */
  readonly titolo = input.required<string>();

  private readonly lingua = inject(LinguaService);
  private readonly tema = inject(TemaService);

  protected readonly larghezza = larghezzaHost();
  protected readonly altezza = ALTEZZA;
  protected readonly margine = MARGINE;
  protected readonly attiva = signal<number | null>(null);
  protected readonly colore = computed(() => COLORE_SERIE[this.tema.temaAttuale()]);
  protected readonly altezzaUtile = computed(() => ALTEZZA - MARGINE.sopra - MARGINE.sotto);

  private readonly scala = computed(() =>
    scalaTonda(Math.max(0, ...this.punti().map((p) => p.numero))),
  );

  protected readonly tacche = computed(() => {
    const { massimo, passo } = this.scala();
    const tacche = [];
    for (let valore = 0; valore <= massimo; valore += passo) {
      tacche.push({ valore, y: this.y(valore) });
    }
    return tacche;
  });

  protected readonly colonne = computed(() => {
    const punti = this.punti();
    const utile = this.larghezza() - MARGINE.sinistra - MARGINE.destra;
    const fascia = utile / Math.max(1, punti.length);
    const spessore = Math.max(1, Math.min(SPESSORE_MASSIMO, fascia - 2, fascia * 0.72));
    // Etichette dell'asse x diradate perché non si sovrappongano.
    const ogni = Math.max(1, Math.ceil(SPAZIO_ETICHETTA_PX / fascia));
    const base = this.y(0);
    return punti.map((punto, i) => {
      const x0 = MARGINE.sinistra + i * fascia;
      const centro = x0 + fascia / 2;
      const y = this.y(punto.numero);
      const h = base - y;
      return {
        punto,
        centro,
        h,
        d: percorsoColonna(centro - spessore / 2, y, spessore, h),
        fascia: { x: x0, w: fascia },
        etichetta: i % ogni === 0 ? this.formattaPeriodo(punto.periodo, false) : null,
        etichettaEstesa: this.formattaPeriodo(punto.periodo, true),
      };
    });
  });

  protected readonly dettaglio = computed(() => {
    const i = this.attiva();
    const colonna = i === null ? undefined : this.colonne()[i];
    if (!colonna) {
      return null;
    }
    return {
      x: colonna.centro,
      y: Math.min(this.y(colonna.punto.numero), this.y(0) - 4),
      numero: colonna.punto.numero,
      etichetta: colonna.etichettaEstesa,
    };
  });

  protected readonly riassunto = computed(() => {
    const totale = this.punti().reduce((s, p) => s + p.numero, 0);
    return `${this.titolo()}: ${this.formattaNumero(totale)}`;
  });

  private y(valore: number): number {
    const { massimo } = this.scala();
    return MARGINE.sopra + this.altezzaUtile() * (1 - valore / massimo);
  }

  protected formattaNumero(valore: number): string {
    return new Intl.NumberFormat(this.lingua.attiva()).format(valore);
  }

  private formattaPeriodo(iso: string, esteso: boolean): string {
    const data = new Date(`${iso}T00:00:00`);
    const lingua = this.lingua.attiva();
    switch (this.granularita()) {
      case 'MESE':
        return new Intl.DateTimeFormat(lingua, {
          month: esteso ? 'long' : 'short',
          year: esteso ? 'numeric' : '2-digit',
        }).format(data);
      case 'SETTIMANA':
        return esteso
          ? `${new Intl.DateTimeFormat(lingua, { day: 'numeric', month: 'short' }).format(data)} – ${new Intl.DateTimeFormat(lingua, { day: 'numeric', month: 'short' }).format(new Date(data.getTime() + 6 * 86_400_000))}`
          : new Intl.DateTimeFormat(lingua, { day: 'numeric', month: 'short' }).format(data);
      default:
        return new Intl.DateTimeFormat(
          lingua,
          esteso
            ? { weekday: 'short', day: 'numeric', month: 'short' }
            : { day: 'numeric', month: 'short' },
        ).format(data);
    }
  }
}
