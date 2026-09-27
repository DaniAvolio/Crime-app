import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Utente } from '../models/utente.model';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegistrazioneRequest {
  nome: string;
  cognome: string;
  email: string;
  password: string;
}

/** Risposta di login/registrazione: JWT da inviare come "Authorization: Bearer". */
export interface AuthResponse {
  token: string;
  scadenza: string; // ISO 8601
  utente: Utente;
}

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, payload);
  }

  registrazione(payload: RegistrazioneRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/registrazione`, payload);
  }

  me(): Observable<Utente> {
    return this.http.get<Utente>(`${this.baseUrl}/me`);
  }
}
