import { StatoSegnalazione } from './segnalazione.model';

export enum TipoAttoreModerazione {
  SISTEMA = 'SISTEMA',
  AUTORE = 'AUTORE',
  ADMIN = 'ADMIN',
}

export interface EventoModerazione {
  id: number;
  segnalazioneId: number;
  statoPrecedente: StatoSegnalazione;
  statoNuovo: StatoSegnalazione;
  tipoAttore: TipoAttoreModerazione;
  amministratoreNome?: string;
  motivazione?: string;
  dataEvento: string;
}
