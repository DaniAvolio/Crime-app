package com.daniele.crime_app_backend.dto;

import java.util.Map;

/** Rappresentazione di Categoria esposta via API. Non espone mai l'entità JPA direttamente. */
public record CategoriaDto(
        Long id,
        String nome,
        String descrizione,
        String icona,
        Integer durataValiditaOre,
        Integer gravita,
        boolean attiva,
        /** Traduzioni per codice lingua (es. "en"); nome e descrizione sono in italiano. */
        Map<String, TraduzioneCategoriaDto> traduzioni
) {}
