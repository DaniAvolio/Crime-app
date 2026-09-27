package com.daniele.crime_app_backend.dto;

import jakarta.validation.constraints.NotBlank;

/** Credenziali per il login. */
public record LoginRequest(
        @NotBlank(message = "L'email è obbligatoria")
        String email,

        @NotBlank(message = "La password è obbligatoria")
        String password
) {}
