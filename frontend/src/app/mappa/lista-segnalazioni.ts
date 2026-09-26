import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { LatLng } from 'leaflet';
import { Segnalazione } from '../models/segnalazione.model';
import { NOME_ICONA_FALLBACK } from '../shared/icone-categoria';
import { formattaDistanza, formattaTempoFa } from './formattazione';

interface VoceLista {
  segnalazione: Segnalazione;
  metri: number;
}

/**
 * Vista a lista delle segnalazioni già caricate per l'area della mappa, dalla più vicina.
 * Base per lo step successivo (filtro per raggio): per ora mostra ciò che la mappa ha caricato.
 */
@Component({
  selector: 'app-lista-segnalazioni',
  standalone: true,
  imports: [TranslocoDirective, LucideDynamicIcon],
  templateUrl: './lista-segnalazioni.html',
})
export class ListaSegnalazioni {
  readonly segnalazioni = input.required<Segnalazione[]>();
  /** Posizione dell'utente se nota, altrimenti centro della mappa: da qui si misurano le distanze. */
  readonly riferimento = input.required<LatLng>();
  readonly riferimentoUtente = input(false);
  readonly iconePerCategoria = input.required<Map<number, string>>();

  readonly seleziona = output<Segnalazione>();

  private readonly transloco = inject(TranslocoService);

  protected readonly voci = computed<VoceLista[]>(() => {
    const riferimento = this.riferimento();
    return this.segnalazioni()
      .map((segnalazione) => ({
        segnalazione,
        metri: riferimento.distanceTo([segnalazione.lat, segnalazione.lng]),
      }))
      .sort((a, b) => a.metri - b.metri);
  });

  protected distanza(metri: number): string {
    return formattaDistanza(metri);
  }

  protected tempoFa(iso: string): string {
    return formattaTempoFa(iso, this.transloco.getActiveLang());
  }

  protected icona(categoriaId: number): string {
    return this.iconePerCategoria().get(categoriaId) ?? NOME_ICONA_FALLBACK;
  }
}
