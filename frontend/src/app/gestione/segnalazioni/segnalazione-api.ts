import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Pagina } from '../../models/pagina.model';
import { Segnalazione, StatoSegnalazione } from '../../models/segnalazione.model';
import { EsitoAbuso, MotivoAbuso, SegnalazioneAbuso } from '../../models/segnalazione-abuso.model';
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

/** "Segnala un problema": il segnalante è l'utente autenticato (dal token). */
export interface SegnalazioneAbusoRequest {
  motivo: MotivoAbuso;
  nota: string | null;
}

/** Decisione dell'admin su una segnalazione "da rivedere". */
export interface EsitoRevisioneRequest {
  esito: EsitoAbuso;
  motivazione: string | null;
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
  anonima: string;
  stato: string;
  creataDal: string;
  creataAl: string;
  scadeDal: string;
  scadeAl: string;
  /** DA_RIVEDERE, CON_ABUSI o AUTOMATICA (vedi FiltroRevisione nel backend). */
  revisione: string;
}

/** Filtri della vista lista: null = nessun filtro. */
export interface FiltriVicine {
  gravita: number | null;
  categoriaId: number | null;
}

export interface ConteggioCategoria {
  categoriaId: number;
  numero: number;
}

/** Schede di "Le mie segnalazioni": ATTIVE = stato ATTIVA, CONCLUSE = tutte le altre. */
export type GruppoMie = 'ATTIVE' | 'CONCLUSE';

export interface ConteggiMie {
  attive: number;
  concluse: number;
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

  /** Vista lista: una pagina di segnalazioni attive nel raggio, dalla più vicina (ordinate dal DB). */
  vicinePerDistanza(
    lat: number,
    lng: number,
    raggioMetri: number,
    filtri: FiltriVicine,
    pagina: number,
    dimensione: number,
  ): Observable<Pagina<Segnalazione>> {
    let params = new HttpParams()
      .set('lat', lat)
      .set('lng', lng)
      .set('raggioMetri', raggioMetri)
      .set('pagina', pagina)
      .set('dimensione', dimensione);
    if (filtri.gravita !== null) {
      params = params.set('gravita', filtri.gravita);
    }
    if (filtri.categoriaId !== null) {
      params = params.set('categoriaId', filtri.categoriaId);
    }
    return this.http.get<Pagina<Segnalazione>>(`${this.baseUrl}/vicine/lista`, { params });
  }

  /** Vista lista: quante segnalazioni attive per categoria nel raggio (chip dei filtri). */
  conteggiVicine(
    lat: number,
    lng: number,
    raggioMetri: number,
    gravita: number | null,
  ): Observable<ConteggioCategoria[]> {
    let params = new HttpParams().set('lat', lat).set('lng', lng).set('raggioMetri', raggioMetri);
    if (gravita !== null) {
      params = params.set('gravita', gravita);
    }
    return this.http.get<ConteggioCategoria[]>(`${this.baseUrl}/vicine/conteggi`, { params });
  }

  /** Profilo: le mie segnalazioni di una scheda, a pagine e dalla più recente. */
  mie(gruppo: GruppoMie, pagina: number, dimensione: number): Observable<Pagina<Segnalazione>> {
    const params = new HttpParams()
      .set('gruppo', gruppo)
      .set('pagina', pagina)
      .set('dimensione', dimensione);
    return this.http.get<Pagina<Segnalazione>>(`${this.baseUrl}/mie`, { params });
  }

  /** Quante ne ho nelle due schede del profilo, senza caricarle. */
  conteggiMie(): Observable<ConteggiMie> {
    return this.http.get<ConteggiMie>(`${this.baseUrl}/mie/conteggi`);
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

  /** "Segnala un problema": una volta per utente, solo su segnalazioni attive altrui. */
  segnalaAbuso(id: number, payload: SegnalazioneAbusoRequest): Observable<SegnalazioneAbuso> {
    return this.http.post<SegnalazioneAbuso>(`${this.baseUrl}/${id}/abusi`, payload);
  }

  /** Abusi di una segnalazione, dal più recente (solo admin). */
  abusi(id: number): Observable<SegnalazioneAbuso[]> {
    return this.http.get<SegnalazioneAbuso[]>(`${this.baseUrl}/${id}/abusi`);
  }

  /**
   * Decisione dell'admin: FONDATO rimuove la segnalazione (se ancora attiva o sospesa),
   * INFONDATO la lascia o la riattiva. Aggiorna la fiducia di segnalanti e autore.
   */
  decidiRevisione(id: number, payload: EsitoRevisioneRequest): Observable<Segnalazione> {
    return this.http.patch<Segnalazione>(`${this.baseUrl}/${id}/abusi/esito`, payload);
  }

  /** Quante segnalazioni sono in coda "da rivedere" (solo admin). */
  contaDaRivedere(): Observable<number> {
    return this.http.get<number>(`${this.baseUrl}/gestione/da-rivedere`);
  }

  riattiva(id: number, payload: SegnalazioneTransizioneRequest): Observable<Segnalazione> {
    return this.http.patch<Segnalazione>(`${this.baseUrl}/${id}/riattiva`, payload);
  }

  /** Cancellazione fisica dal DB (solo admin), a differenza di rimuovi() che cambia lo stato. */
  eliminaDefinitivamente(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
