package com.daniele.crime_app_backend.exception;

/** Login fallito (email inesistente o password errata), mappata su HTTP 401. */
public class CredenzialiNonValideException extends RuntimeException {
    public CredenzialiNonValideException(String messaggio) {
        super(messaggio);
    }
}
