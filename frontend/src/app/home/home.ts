import { NgClass } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslocoDirective } from '@jsverse/transloco';
import { CategorieStore } from '../categorie/categorie-store';
import { NomeCategoriaPipe } from '../categorie/nome-categoria.pipe';
import { NOME_ICONA_FALLBACK, NOMI_ICONE_DISPONIBILI } from '../shared/icone-categoria';

interface FaseCiclo {
  numero: string;
  chiave: 'fase1' | 'fase2' | 'fase3';
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, LucideDynamicIcon, TranslocoDirective, NgClass, NomeCategoriaPipe],
  templateUrl: './home.html',
})
export class Home implements OnInit {
  private readonly store = inject(CategorieStore);

  /** Elenco categorie per il pannello "log": resta vuoto se il backend non risponde. */
  protected readonly categorie = computed(() => this.store.categorie().filter((c) => c.attiva));
  protected readonly caricamentoCompletato = this.store.caricate;

  protected readonly fasiCiclo: readonly FaseCiclo[] = [
    { numero: '01', chiave: 'fase1' },
    { numero: '02', chiave: 'fase2' },
    { numero: '03', chiave: 'fase3' },
  ];

  ngOnInit(): void {
    this.store.carica();
  }

  protected iconaRisolta(nome: string | null | undefined): string {
    if (nome && NOMI_ICONE_DISPONIBILI.includes(nome)) {
      return nome;
    }
    return NOME_ICONA_FALLBACK;
  }
}
