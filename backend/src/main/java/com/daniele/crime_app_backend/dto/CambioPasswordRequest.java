package com.daniele.crime_app_backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Cambio della propria password dal profilo: serve quella attuale, l'utente si ricava dal token. */
public record CambioPasswordRequest(
        @NotBlank(message = "La password attuale è obbligatoria")
        String passwordAttuale,

        @NotBlank(message = "La nuova password è obbligatoria")
        @Size(min = 8, message = "La nuova password deve avere almeno 8 caratteri")
        String nuovaPassword
) {}
