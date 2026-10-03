package com.daniele.crime_app_backend.dto;

import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;
import com.daniele.crime_app_backend.entity.enums.TipoNotifica;

import java.time.LocalDateTime;

/**
 * Avviso della campanella. Il client compone il testo nella lingua attiva da tipo, categoria e
 * zona; stato è quello attuale della segnalazione (per sapere se aprirla sulla mappa).
 */
public record NotificaDto(
        Long id,
        TipoNotifica tipo,
        Long segnalazioneId,
        Long categoriaId,
        String zonaNome,
        StatoSegnalazione stato,
        LocalDateTime dataCreazione,
        boolean letta
) {}
