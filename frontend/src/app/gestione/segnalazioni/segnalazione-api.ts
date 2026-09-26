import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Segnalazione, StatoSegnalazione } from '../../models/segnalazione.model';

export interface SegnalazioneRequest {
  autoreId: number;
  categoriaId: number;
  descrizione: string;
  lat: number;
  lng: number;
  anonima: boolean;
}

/** Payload delle transizioni di stato: l'attore va indicato esplicitamente, non c'è un utente loggato. */
export interface SegnalazioneTransizioneRequest {
  attoreId: number;
  motivazione: string;
}

export interface FiltriSegnalazioni {
  stato?: StatoSegnalazione;
  autoreId?: number;
}

@Injectable({ providedIn: 'root' })
export class SegnalazioneApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/segnalazioni`;

  elenca(filtri?: FiltriSegnalazioni): Observable<Segnalazione[]> {
    let params = new HttpParams();
    if (filtri?.stato) {
      params = params.set('stato', filtri.stato);
    }
    if (filtri?.autoreId != null) {
      params = params.set('autoreId', filtri.autoreId);
    }
    return this.http.get<Segnalazione[]>(this.baseUrl, { params });
  }

  /** Segnalazioni ATTIVA entro `raggioMetri` dal punto indicato (query PostGIS lato backend). */
  vicine(lat: number, lng: number, raggioMetri: number): Observable<Segnalazione[]> {
    const params = new HttpParams().set('lat', lat).set('lng', lng).set('raggioMetri', raggioMetri);
    return this.http.get<Segnalazione[]>(`${this.baseUrl}/vicine`, { params });
  }

  ottieni(id: number): Observable<Segnalazione> {
    return this.http.get<Segnalazione>(`${this.baseUrl}/${id}`);
  }

  crea(payload: SegnalazioneRequest): Observable<Segnalazione> {
    return this.http.post<Segnalazione>(this.baseUrl, payload);
  }

  rimuovi(id: number, payload: SegnalazioneTransizioneRequest): Observable<Segnalazione> {
    return this.http.patch<Segnalazione>(`${this.baseUrl}/${id}/rimuovi`, payload);
  }

  riattiva(id: number, payload: SegnalazioneTransizioneRequest): Observable<Segnalazione> {
    return this.http.patch<Segnalazione>(`${this.baseUrl}/${id}/riattiva`, payload);
  }
}
