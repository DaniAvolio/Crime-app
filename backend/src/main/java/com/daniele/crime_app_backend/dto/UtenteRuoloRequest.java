package com.daniele.crime_app_backend.dto;

import com.daniele.crime_app_backend.entity.enums.RuoloUtente;
import jakarta.validation.constraints.NotNull;

/** Payload per promuovere o declassare un Utente (solo admin). */
public record UtenteRuoloRequest(
        @NotNull(message = "Il ruolo è obbligatorio")
        RuoloUtente ruolo
) {}
