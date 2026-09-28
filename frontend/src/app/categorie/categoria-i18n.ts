import { Categoria } from '../models/categoria.model';

/** Nome nella lingua richiesta; nome e descrizione della categoria sono in italiano e fanno da fallback. */
export function nomeCategoria(categoria: Pick<Categoria, 'nome' | 'traduzioni'>, lingua: string): string {
  return categoria.traduzioni?.[lingua]?.nome ?? categoria.nome;
}
