package com.daniele.crime_app_backend.exception;

/** Eccezione generica per una risorsa non trovata (mappata su HTTP 404 da GlobalExceptionHandler). */
public class RisorsaNonTrovataException extends RuntimeException {
    public RisorsaNonTrovataException(String messaggio) {
        super(messaggio);
    }
}
