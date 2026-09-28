import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Utente } from '../models/utente.model';

export interface DatiProfiloRequest {
  nome: string;
  cognome: string;
}

export interface CambioPasswordRequest {
  passwordAttuale: string;
  nuovaPassword: string;
}

/** Operazioni dell'utente su sé stesso: il backend lo ricava dal token, mai un id nel payload. */
@Injectable({ providedIn: 'root' })
export class ProfiloApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/utenti/me`;

  aggiornaDati(payload: DatiProfiloRequest): Observable<Utente> {
    return this.http.put<Utente>(this.baseUrl, payload);
  }

  cambiaPassword(payload: CambioPasswordRequest): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/password`, payload);
  }
}
