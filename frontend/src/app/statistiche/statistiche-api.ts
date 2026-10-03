import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MotivoAbuso } from '../models/segnalazione-abuso.model';

/** Filtri condivisi da mappa di calore e riepilogo: periodo (giorni inclusi) e facoltativi. */
export interface FiltriStatistiche {
  /** ISO yyyy-MM-dd. */
  dal: string;
  al: string;
  gravita: number | null;
  categoriaId: number | null;
}

/** Riquadro visibile della mappa: le statistiche valgono per quest'area. */
export interface Riquadro {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface CellaCalore {
  lat: number;
  lng: number;
  numero: number;
}

export type GranularitaAndamento = 'GIORNO' | 'SETTIMANA' | 'MESE';

export interface PuntoAndamento {
  /** Primo giorno del periodo (ISO). */
  periodo: string;
  numero: number;
}

export interface FasciaOraria {
  /** 1 = lunedì ... 7 = domenica. */
  giornoSettimana: number;
  ora: number;
  numero: number;
}

export interface RiepilogoStatistiche {
  dal: string;
  al: string;
  totale: number;
  totalePeriodoPrecedente: number;
  gravi: number;
  granularita: GranularitaAndamento;
  andamento: PuntoAndamento[];
  /** Solo le combinazioni non vuote. */
  fasce: FasciaOraria[];
  categorie: { categoriaId: number; numero: number }[];
  zoneCalde: CellaCalore[];
}

export interface ModerazioneStatistiche {
  abusi: {
    motivo: MotivoAbuso;
    totale: number;
    accolti: number;
    respinti: number;
    inAttesa: number;
  }[];
  oreMedieRevisione: number | null;
  rimosseDaAdmin: number;
  sospese: number;
  controlliAutomatici: number;
  nuoviUtenti: number;
  inCodaOra: number;
}

function parametri(filtri: FiltriStatistiche, riquadro: Riquadro): HttpParams {
  let params = new HttpParams()
    .set('dal', filtri.dal)
    .set('al', filtri.al)
    .set('minLat', riquadro.minLat)
    .set('minLng', riquadro.minLng)
    .set('maxLat', riquadro.maxLat)
    .set('maxLng', riquadro.maxLng);
  if (filtri.gravita !== null) {
    params = params.set('gravita', filtri.gravita);
  }
  if (filtri.categoriaId !== null) {
    params = params.set('categoriaId', filtri.categoriaId);
  }
  return params;
}

/**
 * Statistiche aggregate dal backend (il browser non riceve mai segnalazioni singole): mappa di
 * calore e riepilogo sono pubblici, la moderazione è solo per gli admin.
 */
@Injectable({ providedIn: 'root' })
export class StatisticheApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/statistiche`;

  mappa(filtri: FiltriStatistiche, riquadro: Riquadro, zoom: number): Observable<CellaCalore[]> {
    return this.http.get<CellaCalore[]>(`${this.baseUrl}/mappa`, {
      params: parametri(filtri, riquadro).set('zoom', zoom),
    });
  }

  riepilogo(filtri: FiltriStatistiche, riquadro: Riquadro): Observable<RiepilogoStatistiche> {
    return this.http.get<RiepilogoStatistiche>(`${this.baseUrl}/riepilogo`, {
      params: parametri(filtri, riquadro),
    });
  }

  moderazione(dal: string, al: string): Observable<ModerazioneStatistiche> {
    const params = new HttpParams().set('dal', dal).set('al', al);
    return this.http.get<ModerazioneStatistiche>(`${this.baseUrl}/moderazione`, { params });
  }
}
