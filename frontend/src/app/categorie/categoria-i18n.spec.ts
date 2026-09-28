import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { Categoria } from '../models/categoria.model';
import { Segnalazione } from '../models/segnalazione.model';
import { LinguaService } from '../shared/lingua';
import { CategoriaApi } from './categoria-api';
import { nomeCategoria } from './categoria-i18n';
import { CategorieStore } from './categorie-store';

const rissa: Categoria = {
  id: 2,
  nome: 'Rissa',
  durataValiditaOre: 4,
  gravita: 3,
  attiva: true,
  traduzioni: { en: { nome: 'Brawl' } },
};

describe('nomeCategoria', () => {
  it('usa la traduzione della lingua richiesta', () => {
    expect(nomeCategoria(rissa, 'en')).toBe('Brawl');
  });

  it("ricade sull'italiano se la traduzione manca", () => {
    expect(nomeCategoria(rissa, 'it')).toBe('Rissa');
    expect(nomeCategoria(rissa, 'fr')).toBe('Rissa');
    expect(nomeCategoria({ nome: 'Furto' }, 'en')).toBe('Furto');
  });
});

describe('CategorieStore.nome', () => {
  const lingua = signal('en');

  beforeEach(() => {
    lingua.set('en');
    TestBed.configureTestingModule({
      providers: [
        { provide: LinguaService, useValue: { attiva: lingua } },
        { provide: CategoriaApi, useValue: { elenca: () => of([rissa]) } },
      ],
    });
  });

  it('traduce il nome di categoria di una segnalazione tramite categoriaId', () => {
    const store = TestBed.inject(CategorieStore);
    const segnalazione = { categoriaId: 2, categoriaNome: 'Rissa' } as Segnalazione;
    store.carica();

    expect(store.nome(segnalazione)).toBe('Brawl');
    lingua.set('it');
    expect(store.nome(segnalazione)).toBe('Rissa');
  });

  it('usa il nome italiano della segnalazione se la categoria non è nota', () => {
    const store = TestBed.inject(CategorieStore);
    const segnalazione = { categoriaId: 99, categoriaNome: 'Vecchia' } as Segnalazione;
    store.carica();

    expect(store.nome(segnalazione)).toBe('Vecchia');
  });
});
