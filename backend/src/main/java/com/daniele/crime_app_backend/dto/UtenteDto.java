package com.daniele.crime_app_backend.dto;

import com.daniele.crime_app_backend.entity.enums.RuoloUtente;

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
        RuoloUtente ruolo,
        LocalDateTime dataRegistrazione,
        LocalDateTime dataAggiornamento,
        int segnalazioniFatte,
        int segnalazioniConfermate,
        int segnalazioniRimosse
) {}
