package com.daniele.crime_app_backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Payload in ingresso per segnalare l'abuso di una Segnalazione. Il segnalante è l'utente autenticato. */
public record SegnalazioneAbusoRequest(
        @NotBlank(message = "Il motivo è obbligatorio")
        @Size(max = 500, message = "Il motivo non può superare i 500 caratteri")
        String motivo
) {}
