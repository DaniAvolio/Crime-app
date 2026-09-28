package com.daniele.crime_app_backend.dto;

import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;

import java.time.LocalDateTime;

/**
 * Rappresentazione di Segnalazione esposta via API. La posizione PostGIS è appiattita in lat/lng.
 * autoreId è null per le segnalazioni anonime, salvo per l'autore stesso e gli admin (vedi SegnalazioneMapper).
 * autoreNome ("Mario R.") segue la stessa regola ed è inoltre null per chi non è autenticato.
 */
public record SegnalazioneDto(
        Long id,
        Long autoreId,
        String autoreNome,
        Long categoriaId,
        String categoriaNome,
        Integer categoriaGravita,
        String descrizione,
        double lat,
        double lng,
        boolean anonima,
        StatoSegnalazione stato,
        LocalDateTime dataCreazione,
        LocalDateTime dataScadenza,
        LocalDateTime dataRimozione,
        LocalDateTime dataUltimaConferma
) {}
