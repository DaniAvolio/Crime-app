package com.daniele.crime_app_backend.dto;

import java.time.LocalTime;
import java.util.List;

/**
 * Preferenze delle notifiche dell'utente corrente (i default se non le ha mai salvate).
 * categorieId vuoto = tutte le categorie con gravità almeno gravitaMinima; ore di silenzio
 * entrambe null = nessun silenzio.
 */
public record PreferenzeNotificaDto(
        boolean notificheAttive,
        int gravitaMinima,
        List<Long> categorieId,
        LocalTime oreSilenzioDa,
        LocalTime oreSilenzioA,
        boolean graviInSilenzio,
        boolean aggiornamentiMie
) {}
