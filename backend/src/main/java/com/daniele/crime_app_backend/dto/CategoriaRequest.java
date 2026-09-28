package com.daniele.crime_app_backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

import java.util.Map;

/** Payload in ingresso per creare/aggiornare una Categoria. */
public record CategoriaRequest(
        @NotBlank(message = "Il nome della categoria è obbligatorio")
        String nome,

        String descrizione,

        String icona,

        @Positive(message = "La durata di validità deve essere maggiore di zero")
        Integer durataValiditaOre,

        @NotNull(message = "La gravità è obbligatoria")
        @Min(value = 1, message = "La gravità deve essere compresa tra 1 e 3")
        @Max(value = 3, message = "La gravità deve essere compresa tra 1 e 3")
        Integer gravita,

        /** Traduzioni opzionali per codice lingua ISO 639-1 (es. "en"). */
        Map<@Pattern(regexp = "^[a-z]{2}$", message = "Il codice lingua deve essere di due lettere minuscole") String,
                @Valid TraduzioneCategoriaDto> traduzioni
) {}
