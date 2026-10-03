package com.daniele.crime_app_backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Sottoscrizione Web Push del browser (PushSubscription.toJSON(): endpoint e chiavi) più la
 * lingua del dispositivo, in cui verranno scritte le push.
 */
public record SottoscrizionePushRequest(
        @NotBlank(message = "L'endpoint è obbligatorio")
        @Size(max = 1000, message = "Endpoint troppo lungo")
        @Pattern(regexp = "^https://.+", message = "L'endpoint deve essere https")
        String endpoint,

        @NotBlank(message = "La chiave p256dh è obbligatoria")
        @Size(max = 200)
        String p256dh,

        @NotBlank(message = "La chiave auth è obbligatoria")
        @Size(max = 100)
        String auth,

        @Size(max = 10)
        String lingua
) {}
