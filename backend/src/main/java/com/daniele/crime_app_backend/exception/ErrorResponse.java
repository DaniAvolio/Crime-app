package com.daniele.crime_app_backend.exception;

import java.time.LocalDateTime;

/** Corpo di risposta uniforme per tutti gli errori dell'API. */
public record ErrorResponse(LocalDateTime timestamp, int status, String errore, String messaggio) {}
