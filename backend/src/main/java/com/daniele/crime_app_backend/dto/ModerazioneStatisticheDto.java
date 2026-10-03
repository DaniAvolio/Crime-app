package com.daniele.crime_app_backend.dto;

import com.daniele.crime_app_backend.entity.enums.MotivoAbuso;

import java.util.List;

/**
 * Statistiche di moderazione di un periodo (solo admin). oreMedieRevisione: tempo medio tra un
 * abuso e la decisione dell'admin, null se nel periodo non ce ne sono state.
 */
public record ModerazioneStatisticheDto(
        List<AbusiPerMotivo> abusi,
        Double oreMedieRevisione,
        long rimosseDaAdmin,
        long sospese,
        long controlliAutomatici,
        long nuoviUtenti,
        long inCodaOra
) {
    public record AbusiPerMotivo(MotivoAbuso motivo, long totale, long accolti, long respinti, long inAttesa) {}
}
