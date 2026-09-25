package com.daniele.crime_app_backend.dto;

import com.daniele.crime_app_backend.entity.enums.Piattaforma;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Payload in ingresso per registrare un DeviceToken. */
public record DeviceTokenRequest(
        @NotBlank(message = "Il token è obbligatorio")
        String token,

        @NotNull(message = "La piattaforma è obbligatoria")
        Piattaforma piattaforma
) {}
