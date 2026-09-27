package com.daniele.crime_app_backend.dto;

import jakarta.validation.constraints.NotNull;

/** Payload in ingresso per rispondere a "è ancora in atto?" su una Segnalazione. Il votante è l'utente autenticato. */
public record ConfermaSegnalazioneRequest(
        @NotNull(message = "La risposta è obbligatoria")
        Boolean ancoraInAtto
) {}
