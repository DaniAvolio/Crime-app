package com.daniele.crime_app_backend.dto;

import jakarta.validation.constraints.*;

/** Payload in ingresso per creare una Segnalazione. */
public record SegnalazioneRequest(
        @NotNull(message = "L'autore è obbligatorio")
        Long autoreId,

        @NotNull(message = "La categoria è obbligatoria")
        Long categoriaId,

        @NotBlank(message = "La descrizione è obbligatoria")
        @Size(max = 2000, message = "La descrizione non può superare i 2000 caratteri")
        String descrizione,

        @NotNull(message = "La latitudine è obbligatoria")
        @DecimalMin(value = "-90", message = "La latitudine deve essere compresa tra -90 e 90")
        @DecimalMax(value = "90", message = "La latitudine deve essere compresa tra -90 e 90")
        Double lat,

        @NotNull(message = "La longitudine è obbligatoria")
        @DecimalMin(value = "-180", message = "La longitudine deve essere compresa tra -180 e 180")
        @DecimalMax(value = "180", message = "La longitudine deve essere compresa tra -180 e 180")
        Double lng,

        boolean anonima
) {}
