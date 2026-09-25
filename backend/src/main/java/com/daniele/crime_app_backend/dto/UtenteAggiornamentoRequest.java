package com.daniele.crime_app_backend.dto;

import jakarta.validation.constraints.NotBlank;

/** Payload in ingresso per l'aggiornamento del profilo di un Utente (non email/password). */
public record UtenteAggiornamentoRequest(
        @NotBlank(message = "Il nome è obbligatorio")
        String nome,

        @NotBlank(message = "Il cognome è obbligatorio")
        String cognome
) {}
