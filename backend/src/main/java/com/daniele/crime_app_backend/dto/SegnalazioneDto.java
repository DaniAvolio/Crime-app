package com.daniele.crime_app_backend.dto;

import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;

import java.time.LocalDateTime;

/** Rappresentazione di Segnalazione esposta via API. La posizione PostGIS è appiattita in lat/lng. */
public record SegnalazioneDto(
        Long id,
        Long autoreId,
        Long categoriaId,
        String categoriaNome,
        String descrizione,
        double lat,
        double lng,
        boolean anonima,
        StatoSegnalazione stato,
        LocalDateTime dataCreazione,
        LocalDateTime dataScadenza,
        LocalDateTime dataRimozione
) {}
