package com.daniele.crime_app_backend.dto;

import com.daniele.crime_app_backend.entity.enums.EsitoAbuso;
import com.daniele.crime_app_backend.entity.enums.MotivoAbuso;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Rappresentazione di SegnalazioneAbuso esposta via API (solo admin). utenteFiducia è la fiducia
 * attuale del segnalante, peso quella al momento dell'invio; esito null = in attesa.
 */
public record SegnalazioneAbusoDto(
        Long id,
        Long segnalazioneId,
        Long utenteId,
        Integer utenteFiducia,
        MotivoAbuso motivo,
        String nota,
        BigDecimal peso,
        EsitoAbuso esito,
        LocalDateTime dataSegnalazione
) {}
