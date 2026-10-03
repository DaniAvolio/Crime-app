package com.daniele.crime_app_backend.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Zona di notifica da creare o modificare (es. "Casa", 1 km). */
public record ZonaNotificaRequest(
        @NotBlank(message = "Il nome della zona è obbligatorio")
        @Size(max = 40, message = "Il nome della zona può avere al massimo 40 caratteri")
        String nome,

        @NotNull(message = "La latitudine è obbligatoria")
        @DecimalMin(value = "-90") @DecimalMax(value = "90")
        Double lat,

        @NotNull(message = "La longitudine è obbligatoria")
        @DecimalMin(value = "-180") @DecimalMax(value = "180")
        Double lng,

        @Min(value = 200, message = "Il raggio va da 200 m a 5 km")
        @Max(value = 5000, message = "Il raggio va da 200 m a 5 km")
        int raggioMetri
) {}
