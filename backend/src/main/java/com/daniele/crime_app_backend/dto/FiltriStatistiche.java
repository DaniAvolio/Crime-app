package com.daniele.crime_app_backend.dto;

import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

/**
 * Filtri delle statistiche (query string). dal/al sono giorni inclusi (default: ultimi 30 giorni);
 * l'area è il riquadro visibile della mappa; gravità e categoria null = tutte.
 */
public record FiltriStatistiche(
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dal,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate al,
        Integer gravita,
        Long categoriaId,
        Double minLat,
        Double minLng,
        Double maxLat,
        Double maxLng
) {}
