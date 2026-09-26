import { ErrorHandler, Injectable, inject } from '@angular/core';
import { LoggerService } from './logger';

/** Inoltra al LoggerService tutti gli errori non gestiti dell'applicazione. */
@Injectable()
export class LoggerErrorHandler implements ErrorHandler {
  private readonly log = inject(LoggerService);

  handleError(errore: unknown): void {
    this.log.error('Errore non gestito', errore);
  }
}
