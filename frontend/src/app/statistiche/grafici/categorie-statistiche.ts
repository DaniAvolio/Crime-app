import { Component, computed, inject, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { nomeCategoria } from '../../categorie/categoria-i18n';
import { CategorieStore } from '../../categorie/categorie-store';
import { Gravita } from '../../models/gravita.model';
import { chiaveGravita, classePallinoGravita } from '../../shared/gravita';
import { LinguaService } from '../../shared/lingua';
import { TemaService } from '../../shared/tema';
import { COLORE_SERIE } from '../rampa';

/**
 * Segnalazioni per categoria: barre orizzontali a tinta unica, raggruppate sotto le intestazioni
 * di gravità (Alta, Media, Bassa). La gravità non è affidata al solo colore (rosso e arancio
 * della palette sono troppo vicini per distinguerli in un grafico): la dice il testo.
 * Valore in fondo a ogni barra; la lunghezza è relativa alla categoria più frequente.
 */
@Component({
  selector: 'app-grafico-categorie',
  standalone: true,
  imports: [TranslocoDirective],
  template: `
    <div *transloco="let t" class="grid gap-4">
      @for (gruppo of gruppi(); track gruppo.gravita) {
        <section>
          <h4
            class="mb-1.5 flex items-center gap-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-muted"
          >
            <span
              class="h-2 w-2 rounded-full"
              [class]="pallino(gruppo.gravita)"
              aria-hidden="true"
            ></span>
            {{ t(chiaveGravita(gruppo.gravita)) }}
          </h4>
          <ul class="grid gap-1.5">
            @for (riga of gruppo.righe; track riga.id) {
              <li
                class="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_1fr]"
              >
                <span class="truncate" [title]="riga.nome">{{ riga.nome }}</span>
                <span class="flex items-center gap-2">
                  <span
                    class="h-3 rounded-r-[4px]"
                    [style.width.%]="riga.quota"
                    [style.background]="colore()"
                    [style.min-width.px]="2"
                  ></span>
                  <span class="text-xs text-gray-700 tabular-nums dark:text-paper">{{
                    riga.numero
                  }}</span>
                </span>
              </li>
            }
          </ul>
        </section>
      } @empty {
        <p class="text-sm text-gray-500 dark:text-muted">—</p>
      }
    </div>
  `,
})
export class GraficoCategorie {
  readonly categorie = input.required<{ categoriaId: number; numero: number }[]>();

  private readonly store = inject(CategorieStore);
  private readonly lingua = inject(LinguaService);
  private readonly tema = inject(TemaService);

  protected readonly chiaveGravita = chiaveGravita;
  protected readonly pallino = classePallinoGravita;
  protected readonly colore = computed(() => COLORE_SERIE[this.tema.temaAttuale()]);

  constructor() {
    this.store.carica();
  }

  protected readonly gruppi = computed(() => {
    const perId = this.store.perId();
    const lingua = this.lingua.attiva();
    const massimo = Math.max(1, ...this.categorie().map((c) => c.numero));
    const gruppi = new Map<
      Gravita,
      { id: number; nome: string; numero: number; quota: number }[]
    >();
    for (const voce of this.categorie()) {
      const categoria = perId.get(voce.categoriaId);
      if (!categoria) {
        continue;
      }
      const righe = gruppi.get(categoria.gravita) ?? [];
      righe.push({
        id: voce.categoriaId,
        nome: nomeCategoria(categoria, lingua),
        numero: voce.numero,
        quota: (voce.numero / massimo) * 88,
      });
      gruppi.set(categoria.gravita, righe);
    }
    return ([3, 2, 1] as Gravita[])
      .filter((gravita) => gruppi.has(gravita))
      .map((gravita) => ({
        gravita,
        righe: gruppi.get(gravita)!.sort((a, b) => b.numero - a.numero),
      }));
  });
}
