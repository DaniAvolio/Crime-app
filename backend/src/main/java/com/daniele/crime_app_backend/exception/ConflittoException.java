package com.daniele.crime_app_backend.exception;

/** Eccezione generica per un conflitto (es. valore duplicato), mappata su HTTP 409. */
public class ConflittoException extends RuntimeException {
    public ConflittoException(String messaggio) {
        super(messaggio);
    }
}
