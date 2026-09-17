export enum Piattaforma {
  ANDROID = 'ANDROID',
  IOS = 'IOS',
  WEB = 'WEB',
}

export interface DeviceToken {
  id: number;
  token: string;
  piattaforma: Piattaforma;
  dataRegistrazione: string;
  ultimoUtilizzo?: string;
}
