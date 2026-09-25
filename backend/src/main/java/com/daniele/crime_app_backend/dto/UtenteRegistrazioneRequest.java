package com.daniele.crime_app_backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Payload in ingresso per la registrazione di un nuovo Utente. */
public record UtenteRegistrazioneRequest(
        @NotBlank(message = "Il nome è obbligatorio")
        String nome,

        @NotBlank(message = "Il cognome è obbligatorio")
        String cognome,

        @NotBlank(message = "L'email è obbligatoria")
        @Email(message = "L'email non è valida")
        String email,

        @NotBlank(message = "La password è obbligatoria")
        @Size(min = 8, message = "La password deve avere almeno 8 caratteri")
        String password
) {}
