package com.daniele.crime_app_backend.dto;

import jakarta.validation.constraints.NotNull;

/** Payload in ingresso per rispondere a "è ancora in atto?" su una Segnalazione. */
public record ConfermaSegnalazioneRequest(
        @NotNull(message = "L'utente che vota è obbligatorio")
        Long utenteId,

        @NotNull(message = "La risposta è obbligatoria")
        Boolean ancoraInAtto
) {}
