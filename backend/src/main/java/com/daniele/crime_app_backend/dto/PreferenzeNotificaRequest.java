package com.daniele.crime_app_backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalTime;
import java.util.List;

/** Preferenze delle notifiche dell'utente autenticato (sostituisce quelle salvate). */
public record PreferenzeNotificaRequest(
        boolean notificheAttive,

        @Min(value = 1, message = "La gravità minima va da 1 a 3")
        @Max(value = 3, message = "La gravità minima va da 1 a 3")
        int gravitaMinima,

        @NotNull(message = "L'elenco delle categorie è obbligatorio (vuoto = tutte)")
        @Size(max = 100, message = "Troppe categorie")
        List<Long> categorieId,

        LocalTime oreSilenzioDa,
        LocalTime oreSilenzioA,
        boolean graviInSilenzio,
        boolean aggiornamentiMie
) {}
