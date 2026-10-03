package com.daniele.crime_app_backend.dto;

import com.daniele.crime_app_backend.entity.enums.MotivoAbuso;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Payload in ingresso per segnalare un problema su una Segnalazione. Il segnalante è l'utente autenticato. */
public record SegnalazioneAbusoRequest(
        @NotNull(message = "Il motivo è obbligatorio")
        MotivoAbuso motivo,

        @Size(max = 300, message = "La nota non può superare i 300 caratteri")
        String nota
) {}
