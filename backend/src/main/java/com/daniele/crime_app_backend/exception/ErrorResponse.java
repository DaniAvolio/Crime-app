package com.daniele.crime_app_backend.exception;

import com.daniele.crime_app_backend.service.moderazione.Violazione;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Corpo di risposta uniforme per tutti gli errori dell'API. "violazioni" c'è solo quando una
 * descrizione non supera i controlli di moderazione (vedi DescrizioneNonValidaException): il
 * client mostra un messaggio per tipo citando il frammento da correggere.
 */
public record ErrorResponse(LocalDateTime timestamp, int status, String errore, String messaggio,
                            @JsonInclude(JsonInclude.Include.NON_NULL) List<Violazione> violazioni) {

    public ErrorResponse(LocalDateTime timestamp, int status, String errore, String messaggio) {
        this(timestamp, status, errore, messaggio, null);
    }
}
