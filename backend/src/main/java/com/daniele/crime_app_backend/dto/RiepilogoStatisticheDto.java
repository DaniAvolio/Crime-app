package com.daniele.crime_app_backend.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Statistiche pubbliche di un'area e un periodo (segnalazioni ATTIVA e SCADUTA, comprese quelle
 * anonimizzate). totalePeriodoPrecedente copre lo stesso numero di giorni subito prima di "dal".
 * andamento ha un punto per ogni periodo, anche vuoto; fasce solo le combinazioni non vuote.
 */
public record RiepilogoStatisticheDto(
        LocalDate dal,
        LocalDate al,
        long totale,
        long totalePeriodoPrecedente,
        long gravi,
        GranularitaAndamento granularita,
        List<PuntoAndamentoDto> andamento,
        List<FasciaOrariaDto> fasce,
        List<ConteggioCategoriaDto> categorie,
        List<CellaCaloreDto> zoneCalde
) {}
