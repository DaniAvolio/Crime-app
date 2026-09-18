package com.daniele.crime_app_backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

/** Payload in ingresso per creare/aggiornare una Categoria. */
public record CategoriaRequest(
        @NotBlank(message = "Il nome della categoria è obbligatorio")
        String nome,

        String descrizione,

        String icona,

        @Positive(message = "La durata di validità deve essere maggiore di zero")
        Integer durataValiditaOre
) {}
