import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RuoloUtente, Utente } from '../../models/utente.model';

export interface UtenteRegistrazioneRequest {
  nome: string;
  cognome: string;
  email: string;
  password: string;
}

/** Aggiornamento: solo nome/cognome, il backend non permette di cambiare email/password da qui. */
export interface UtenteAggiornamentoRequest {
  nome: string;
  cognome: string;
}

@Injectable({ providedIn: 'root' })
export class UtenteApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/utenti`;

  elenca(): Observable<Utente[]> {
    return this.http.get<Utente[]>(this.baseUrl);
  }

  ottieni(id: number): Observable<Utente> {
    return this.http.get<Utente>(`${this.baseUrl}/${id}`);
  }

  crea(payload: UtenteRegistrazioneRequest): Observable<Utente> {
    return this.http.post<Utente>(this.baseUrl, payload);
  }

  aggiorna(id: number, payload: UtenteAggiornamentoRequest): Observable<Utente> {
    return this.http.put<Utente>(`${this.baseUrl}/${id}`, payload);
  }

  /** Solo admin; il backend impedisce di declassare l'ultimo admin attivo (409). */
  cambiaRuolo(id: number, ruolo: RuoloUtente): Observable<Utente> {
    return this.http.patch<Utente>(`${this.baseUrl}/${id}/ruolo`, { ruolo });
  }

  disattiva(id: number): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/disattiva`, {});
  }

  riattiva(id: number): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/riattiva`, {});
  }

  elimina(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
