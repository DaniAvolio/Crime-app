import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { CategoriaApi } from '../categorie/categoria-api';
import { Categoria } from '../models/categoria.model';
import { NOME_ICONA_FALLBACK, NOMI_ICONE_DISPONIBILI } from '../shared/icone-categoria';

interface FaseCiclo {
  numero: string;
  titolo: string;
  descrizione: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, LucideDynamicIcon],
  templateUrl: './home.html',
})
export class Home implements OnInit {
  private readonly categoriaApi = inject(CategoriaApi);

  /** Elenco categorie per il pannello "log": resta vuoto se il backend non risponde. */
  protected readonly categorie = signal<Categoria[]>([]);
  protected readonly caricamentoCompletato = signal(false);

  protected readonly fasiCiclo: readonly FaseCiclo[] = [
    {
      numero: '01',
      titolo: 'Apri la mappa e scegli un punto',
      descrizione: "Indica dove è successo l'evento e seleziona la categoria più adatta.",
    },
    {
      numero: '02',
      titolo: 'La segnalazione resta visibile fino alla scadenza',
      descrizione:
        'Ogni categoria ha una durata di validità: passato quel tempo, la segnalazione sparisce da sola.',
    },
    {
      numero: '03',
      titolo: 'La community modera gli abusi',
      descrizione:
        'Le segnalazioni sospette possono essere segnalate e vengono riviste da chi gestisce la piattaforma.',
    },
  ];

  ngOnInit(): void {
    this.categoriaApi.elenca().subscribe({
      next: (categorie) => {
        this.categorie.set(categorie.filter((c) => c.attiva));
        this.caricamentoCompletato.set(true);
      },
      error: () => {
        this.categorie.set([]);
        this.caricamentoCompletato.set(true);
      },
    });
  }

  protected iconaRisolta(nome: string | null | undefined): string {
    if (nome && NOMI_ICONE_DISPONIBILI.includes(nome)) {
      return nome;
    }
    return NOME_ICONA_FALLBACK;
  }
}
