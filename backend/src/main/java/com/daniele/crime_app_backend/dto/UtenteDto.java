package com.daniele.crime_app_backend.dto;

import java.time.LocalDateTime;

/** Rappresentazione di Utente esposta via API. Non espone mai passwordHash. */
public record UtenteDto(
        Long id,
        String nome,
        String cognome,
        String email,
        boolean identitaVerificata,
        Integer punteggioFiducia,
        boolean attivo,
        LocalDateTime dataRegistrazione,
        LocalDateTime dataAggiornamento
) {}
