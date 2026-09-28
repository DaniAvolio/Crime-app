import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Categoria, TraduzioneCategoria } from '../models/categoria.model';
import { Gravita } from '../models/gravita.model';

/** Payload di creazione/modifica: nessun id, nessun flag "attiva" (gestito dal backend). */
export interface CategoriaRequest {
  nome: string;
  descrizione?: string;
  icona?: string;
  durataValiditaOre: number;
  gravita: Gravita;
  /** Le lingue assenti o senza nome usano l'italiano come fallback. */
  traduzioni?: Record<string, TraduzioneCategoria>;
}

@Injectable({ providedIn: 'root' })
export class CategoriaApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/categorie`;

  elenca(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(this.baseUrl);
  }

  crea(payload: CategoriaRequest): Observable<Categoria> {
    return this.http.post<Categoria>(this.baseUrl, payload);
  }

  aggiorna(id: number, payload: CategoriaRequest): Observable<Categoria> {
    return this.http.put<Categoria>(`${this.baseUrl}/${id}`, payload);
  }

  /** Disattivazione logica: la categoria resta nel DB e può essere riattivata. */
  disattiva(id: number): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/disattiva`, {});
  }

  riattiva(id: number): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/riattiva`, {});
  }

  /** Cancellazione fisica: dopo questa chiamata la categoria non esiste più nel DB. */
  eliminaDefinitivamente(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
