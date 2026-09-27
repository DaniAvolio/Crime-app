package com.daniele.crime_app_backend.exception;

/** L'utente autenticato non ha i permessi per l'operazione richiesta, mappata su HTTP 403. */
public class AccessoNegatoException extends RuntimeException {
    public AccessoNegatoException(String messaggio) {
        super(messaggio);
    }
}
