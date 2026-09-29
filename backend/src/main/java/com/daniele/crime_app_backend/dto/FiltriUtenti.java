package com.daniele.crime_app_backend.dto;

import com.daniele.crime_app_backend.entity.enums.RuoloUtente;

/** Filtri della tabella utenti in gestione (query string); ogni campo null è ignorato. */
public record FiltriUtenti(
        String nome,
        String cognome,
        String email,
        Boolean identitaVerificata,
        Integer fiduciaMin,
        Integer fiduciaMax,
        Boolean attivo,
        RuoloUtente ruolo
) {}
