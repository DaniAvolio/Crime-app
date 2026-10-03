package com.daniele.crime_app_backend.dto;

import com.daniele.crime_app_backend.entity.enums.EsitoAbuso;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Decisione dell'admin su una segnalazione "da rivedere": FONDATO la rimuove (se ancora ATTIVA o
 * SOSPESA), INFONDATO la lascia o la riporta ATTIVA. La motivazione finisce nello storico.
 */
public record EsitoRevisioneRequest(
        @NotNull(message = "L'esito è obbligatorio")
        EsitoAbuso esito,

        @Size(max = 500, message = "La motivazione non può superare i 500 caratteri")
        String motivazione
) {}
