package com.daniele.crime_app_backend.dto;

import java.time.LocalDateTime;

/** Rappresentazione di SegnalazioneAbuso esposta via API. */
public record SegnalazioneAbusoDto(
        Long id,
        Long segnalazioneId,
        Long utenteId,
        String motivo,
        LocalDateTime dataSegnalazione
) {}
