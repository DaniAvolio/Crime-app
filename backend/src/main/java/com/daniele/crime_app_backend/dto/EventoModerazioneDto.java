package com.daniele.crime_app_backend.dto;

import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;
import com.daniele.crime_app_backend.entity.enums.TipoAttoreModerazione;

import java.time.LocalDateTime;

/** Rappresentazione di EventoModerazione esposta via API. Sola lettura: gli eventi sono creati internamente. */
public record EventoModerazioneDto(
        Long id,
        Long segnalazioneId,
        StatoSegnalazione statoPrecedente,
        StatoSegnalazione statoNuovo,
        TipoAttoreModerazione tipoAttore,
        Long amministratoreId,
        String motivazione,
        LocalDateTime dataEvento
) {}
