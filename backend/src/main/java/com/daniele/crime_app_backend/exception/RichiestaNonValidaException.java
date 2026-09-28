package com.daniele.crime_app_backend.exception;

/**
 * Richiesta formalmente valida ma non accettabile (es. password attuale errata nel cambio
 * password), mappata su HTTP 400. Non 401: il client tratta un 401 come sessione scaduta e
 * farebbe logout.
 */
public class RichiestaNonValidaException extends RuntimeException {
    public RichiestaNonValidaException(String messaggio) {
        super(messaggio);
    }
}
