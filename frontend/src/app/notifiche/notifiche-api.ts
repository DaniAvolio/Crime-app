import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Pagina } from '../models/pagina.model';
import { Notifica, PreferenzeNotifica, ZonaNotifica } from '../models/preferenze-notifica.model';

export type ZonaNotificaRequest = Omit<ZonaNotifica, 'id'>;

/** Sottoscrizione Web Push del browser (PushSubscription.toJSON) più la lingua del dispositivo. */
export interface SottoscrizionePush {
  endpoint: string;
  p256dh: string;
  auth: string;
  lingua: string;
}

/** Avvisi, zone, preferenze e sottoscrizioni push dell'utente autenticato. */
@Injectable({ providedIn: 'root' })
export class NotificheApi {
  private readonly http = inject(HttpClient);
  private readonly me = `${environment.apiUrl}/utenti/me`;

  notifiche(pagina: number, dimensione: number): Observable<Pagina<Notifica>> {
    const params = new HttpParams().set('pagina', pagina).set('dimensione', dimensione);
    return this.http.get<Pagina<Notifica>>(`${this.me}/notifiche`, { params });
  }

  nonLette(): Observable<number> {
    return this.http.get<number>(`${this.me}/notifiche/non-lette`);
  }

  segnaLetta(id: number): Observable<void> {
    return this.http.patch<void>(`${this.me}/notifiche/${id}/letta`, null);
  }

  segnaTutteLette(): Observable<void> {
    return this.http.patch<void>(`${this.me}/notifiche/lette`, null);
  }

  zone(): Observable<ZonaNotifica[]> {
    return this.http.get<ZonaNotifica[]>(`${this.me}/zone-notifica`);
  }

  creaZona(zona: ZonaNotificaRequest): Observable<ZonaNotifica> {
    return this.http.post<ZonaNotifica>(`${this.me}/zone-notifica`, zona);
  }

  aggiornaZona(id: number, zona: ZonaNotificaRequest): Observable<ZonaNotifica> {
    return this.http.put<ZonaNotifica>(`${this.me}/zone-notifica/${id}`, zona);
  }

  eliminaZona(id: number): Observable<void> {
    return this.http.delete<void>(`${this.me}/zone-notifica/${id}`);
  }

  preferenze(): Observable<PreferenzeNotifica> {
    return this.http.get<PreferenzeNotifica>(`${this.me}/preferenze-notifica`);
  }

  salvaPreferenze(preferenze: PreferenzeNotifica): Observable<PreferenzeNotifica> {
    return this.http.put<PreferenzeNotifica>(`${this.me}/preferenze-notifica`, preferenze);
  }

  chiavePubblica(): Observable<{ chiave: string }> {
    return this.http.get<{ chiave: string }>(`${environment.apiUrl}/push/chiave-pubblica`);
  }

  sottoscrivi(sottoscrizione: SottoscrizionePush): Observable<void> {
    return this.http.post<void>(`${this.me}/push`, sottoscrizione);
  }

  disiscrivi(endpoint: string): Observable<void> {
    return this.http.delete<void>(`${this.me}/push`, {
      params: new HttpParams().set('endpoint', endpoint),
    });
  }
}
