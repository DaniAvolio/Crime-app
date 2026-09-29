import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Pagina } from '../../models/pagina.model';
import { Segnalazione, StatoSegnalazione } from '../../models/segnalazione.model';
import { RichiestaPagina, parametriPagina } from '../../shared/tabella/tabella';

/** L'autore è l'utente autenticato: il backend lo ricava dal token. */
export interface SegnalazioneRequest {
  categoriaId: number;
  descrizione: string;
  lat: number;
  lng: number;
  anonima: boolean;
}

/** Payload delle transizioni di stato: l'attore è l'utente autenticato (autore o admin). */
export interface SegnalazioneTransizioneRequest {
  motivazione: string;
}

/** Risposta a "è ancora in atto?": un voto per utente, modificabile. */
export interface ConfermaSegnalazioneRequest {
  ancoraInAtto: boolean;
}

export interface FiltriSegnalazioni {
  stato?: StatoSegnalazione;
  autoreId?: number;
  /** Solo quelle dell'utente autenticato (il backend lo ricava dal token). */
  mie?: boolean;
}

/** Filtri della tabella in gestione, come scritti nei campi: stringa vuota = non filtrare. */
export interface FiltriGestioneSegnalazioni {
  [campo: string]: string;
  id: string;
  categoriaId: string;
  descrizione: string;
  anonima: string;
  stato: string;
  creataDal: string;
  creataAl: string;
  scadeDal: string;
  scadeAl: string;
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
    if (filtri?.mie) {
      params = params.set('mie', true);
    }
    return this.http.get<Segnalazione[]>(this.baseUrl, { params });
  }

  /** Tabella di gestione (solo admin): filtri, ordinamento e paginazione lato backend. */
  pagina(richiesta: RichiestaPagina<FiltriGestioneSegnalazioni>): Observable<Pagina<Segnalazione>> {
    return this.http.get<Pagina<Segnalazione>>(`${this.baseUrl}/gestione`, {
      params: parametriPagina(richiesta),
    });
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

  /** Restituisce la segnalazione aggiornata: nuova scadenza, oppure stato SCADUTA se chiusa dai voti. */
  conferma(id: number, payload: ConfermaSegnalazioneRequest): Observable<Segnalazione> {
    return this.http.post<Segnalazione>(`${this.baseUrl}/${id}/conferme`, payload);
  }

  riattiva(id: number, payload: SegnalazioneTransizioneRequest): Observable<Segnalazione> {
    return this.http.patch<Segnalazione>(`${this.baseUrl}/${id}/riattiva`, payload);
  }

  /** Cancellazione fisica dal DB (solo admin), a differenza di rimuovi() che cambia lo stato. */
  eliminaDefinitivamente(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
