package com.daniele.crime_app_backend.dto;

import com.daniele.crime_app_backend.entity.enums.Piattaforma;

import java.time.LocalDateTime;

/** Rappresentazione di DeviceToken esposta via API. */
public record DeviceTokenDto(
        Long id,
        Long utenteId,
        String token,
        Piattaforma piattaforma,
        LocalDateTime dataRegistrazione,
        LocalDateTime ultimoUtilizzo
) {}
