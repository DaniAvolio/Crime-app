package com.daniele.crime_app_backend.dto;

/** Rappresentazione di Categoria esposta via API. Non espone mai l'entità JPA direttamente. */
public record CategoriaDto(
        Long id,
        String nome,
        String descrizione,
        String icona,
        Integer durataValiditaOre,
        boolean attiva
) {}
