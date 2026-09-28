import { Pipe, PipeTransform, inject } from '@angular/core';
import { Categoria } from '../models/categoria.model';
import { Segnalazione } from '../models/segnalazione.model';
import { CategorieStore } from './categorie-store';

/**
 * `{{ categoria | nomeCategoria }}` o `{{ segnalazione | nomeCategoria }}`: nome nella lingua
 * attiva, con fallback all'italiano. Impura perché dipende da lingua e categorie caricate
 * (entrambi signal), non solo dall'argomento; il costo è una lookup in una Map.
 */
@Pipe({ name: 'nomeCategoria', standalone: true, pure: false })
export class NomeCategoriaPipe implements PipeTransform {
  private readonly store = inject(CategorieStore);

  transform(categoria: Categoria | Segnalazione): string {
    return this.store.nome(categoria);
  }
}
