package com.daniele.crime_app_backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Payload per una transizione di stato manuale (rimozione, riattivazione).
 * In assenza di autenticazione reale (vedi SecurityConfig), l'attore viene
 * identificato esplicitamente: se coincide con l'autore della segnalazione è
 * trattato come AUTORE, altrimenti come ADMIN (vedi SegnalazioneService).
 */
public record SegnalazioneTransizioneRequest(
        @NotNull(message = "L'attore che compie l'operazione è obbligatorio")
        Long attoreId,

        @Size(max = 500, message = "La motivazione non può superare i 500 caratteri")
        String motivazione
) {}
