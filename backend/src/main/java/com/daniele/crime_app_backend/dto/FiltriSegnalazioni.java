package com.daniele.crime_app_backend.dto;

import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

/**
 * Filtri della tabella segnalazioni in gestione (query string); ogni campo null è ignorato.
 * La descrizione (testo libero) non è filtrabile: una ricerca "contiene" non userebbe indici.
 */
public record FiltriSegnalazioni(
        Long id,
        Long categoriaId,
        Boolean anonima,
        StatoSegnalazione stato,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate creataDal,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate creataAl,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate scadeDal,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate scadeAl,
        FiltroRevisione revisione
) {}
