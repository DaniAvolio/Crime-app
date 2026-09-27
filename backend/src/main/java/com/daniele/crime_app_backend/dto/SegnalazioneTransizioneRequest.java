package com.daniele.crime_app_backend.dto;

import jakarta.validation.constraints.Size;

/**
 * Payload per una transizione di stato manuale (rimozione, riattivazione).
 * L'attore è l'utente autenticato: AUTORE se coincide con l'autore della
 * segnalazione, ADMIN se ha quel ruolo (vedi SegnalazioneService).
 */
public record SegnalazioneTransizioneRequest(
        @Size(max = 500, message = "La motivazione non può superare i 500 caratteri")
        String motivazione
) {}
