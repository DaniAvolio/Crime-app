import { NgClass } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslocoDirective } from '@jsverse/transloco';
import { CategoriaApi } from '../categorie/categoria-api';
import { Categoria } from '../models/categoria.model';
import { NOME_ICONA_FALLBACK, NOMI_ICONE_DISPONIBILI } from '../shared/icone-categoria';

interface FaseCiclo {
  numero: string;
  chiave: 'fase1' | 'fase2' | 'fase3';
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, LucideDynamicIcon, TranslocoDirective, NgClass],
  templateUrl: './home.html',
})
export class Home implements OnInit {
  private readonly categoriaApi = inject(CategoriaApi);

  /** Elenco categorie per il pannello "log": resta vuoto se il backend non risponde. */
  protected readonly categorie = signal<Categoria[]>([]);
  protected readonly caricamentoCompletato = signal(false);

  protected readonly fasiCiclo: readonly FaseCiclo[] = [
    { numero: '01', chiave: 'fase1' },
    { numero: '02', chiave: 'fase2' },
    { numero: '03', chiave: 'fase3' },
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
