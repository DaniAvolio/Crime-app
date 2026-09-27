package com.daniele.crime_app_backend.dto;

import java.time.Instant;

/** Risposta di login/registrazione: JWT da inviare come "Authorization: Bearer", sua scadenza e utente autenticato. */
public record AuthResponse(
        String token,
        Instant scadenza,
        UtenteDto utente
) {}
