package com.daniele.crime_app_backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** Payload in ingresso per creare/aggiornare le PreferenzeNotifica di un Utente. */
public record PreferenzeNotificaRequest(
        @NotNull(message = "Il raggio di notifica è obbligatorio")
        @Positive(message = "Il raggio di notifica deve essere maggiore di zero")
        Integer raggioNotificaMetri,

        boolean notificheAttive,

        boolean notificheSoloCategoriePreferite
) {}
