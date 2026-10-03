package com.daniele.crime_app_backend.dto;

import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Rappresentazione di Segnalazione esposta via API. La posizione PostGIS è appiattita in lat/lng.
 * autoreId è null per le segnalazioni anonime, salvo per l'autore stesso e gli admin (vedi SegnalazioneMapper).
 * autoreNome ("Mario R.") segue la stessa regola ed è inoltre null per chi non è autenticato.
 * mioVoto è la risposta dell'utente autenticato a "è ancora in atto?" (null se non ha votato,
 * per gli ospiti e negli elenchi che non la calcolano, es. gestione e profilo); mioAbuso dice se
 * ha già segnalato un problema (stessa regola).
 * numeroAbusi, pesoAbusi, daRivedere e revisioneAutomatica (coda di moderazione) sono valorizzati
 * solo per gli admin, null per tutti gli altri.
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
        LocalDateTime dataUltimaConferma,
        Boolean mioVoto,
        Boolean mioAbuso,
        Integer numeroAbusi,
        BigDecimal pesoAbusi,
        Boolean daRivedere,
        String revisioneAutomatica
) {}
