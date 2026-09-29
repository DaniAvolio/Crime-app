package com.daniele.crime_app_backend.dto;

/** Filtri della tabella categorie in gestione (query string); ogni campo null è ignorato. */
public record FiltriCategorie(
        String nome,
        Integer gravita,
        Integer durataMin,
        Integer durataMax,
        Boolean attiva
) {}
