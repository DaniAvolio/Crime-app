package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.FiltriStatistiche;
import com.daniele.crime_app_backend.dto.GranularitaAndamento;
import com.daniele.crime_app_backend.dto.PuntoAndamentoDto;
import com.daniele.crime_app_backend.exception.RichiestaNonValidaException;
import com.daniele.crime_app_backend.repository.StatisticheRepository.Ambito;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StatisticheServiceTest {

    private static FiltriStatistiche filtri(LocalDate dal, LocalDate al) {
        return new FiltriStatistiche(dal, al, null, null, 45.0, 7.6, 45.1, 7.8);
    }

    @Test
    void periodoPredefinitoUltimi30GiorniFinoAOggi() {
        LocalDate[] periodo = StatisticheService.periodo(null, null);
        assertThat(periodo[1]).isEqualTo(LocalDate.now());
        assertThat(periodo[0]).isEqualTo(LocalDate.now().minusDays(29));
    }

    @Test
    void ilGiornoFinaleEIncluso() {
        Ambito ambito = StatisticheService.ambito(filtri(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30)));
        assertThat(ambito.da()).isEqualTo(LocalDate.of(2026, 9, 1).atStartOfDay());
        assertThat(ambito.a()).isEqualTo(LocalDate.of(2026, 10, 1).atStartOfDay());
    }

    @Test
    void periodiEAreeNonValidi() {
        assertThatThrownBy(() -> StatisticheService.periodo(LocalDate.of(2026, 9, 2), LocalDate.of(2026, 9, 1)))
                .isInstanceOf(RichiestaNonValidaException.class);
        assertThatThrownBy(() -> StatisticheService.periodo(LocalDate.of(2024, 1, 1), LocalDate.of(2026, 9, 1)))
                .isInstanceOf(RichiestaNonValidaException.class);
        assertThatThrownBy(() -> StatisticheService.ambito(new FiltriStatistiche(null, null, null, null,
                45.1, 7.6, 45.0, 7.8))).isInstanceOf(RichiestaNonValidaException.class);
        assertThatThrownBy(() -> StatisticheService.ambito(new FiltriStatistiche(null, null, null, null,
                null, null, null, null))).isInstanceOf(RichiestaNonValidaException.class);
        assertThatThrownBy(() -> StatisticheService.ambito(new FiltriStatistiche(null, null, 4, null,
                45.0, 7.6, 45.1, 7.8))).isInstanceOf(RichiestaNonValidaException.class);
    }

    @Test
    void laCellaSegueLoZoomMaNonScendeSottoIlMinimo() {
        assertThat(StatisticheService.latoCella(10)).isEqualTo(360.0 / 1024 / 8);
        assertThat(StatisticheService.latoCella(13)).isGreaterThan(StatisticheService.CELLA_MINIMA_GRADI);
        assertThat(StatisticheService.latoCella(18)).isEqualTo(StatisticheService.CELLA_MINIMA_GRADI);
    }

    @Test
    void granularitaInBaseAllaDurata() {
        assertThat(StatisticheService.granularita(7)).isEqualTo(GranularitaAndamento.GIORNO);
        assertThat(StatisticheService.granularita(31)).isEqualTo(GranularitaAndamento.GIORNO);
        assertThat(StatisticheService.granularita(90)).isEqualTo(GranularitaAndamento.SETTIMANA);
        assertThat(StatisticheService.granularita(365)).isEqualTo(GranularitaAndamento.MESE);
    }

    @Test
    void lAndamentoHaUnPuntoPerOgniPeriodoAncheVuoto() {
        List<PuntoAndamentoDto> giorni = StatisticheService.completaAndamento(
                Map.of(LocalDate.of(2026, 9, 2), 5L), LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 3),
                GranularitaAndamento.GIORNO);
        assertThat(giorni).extracting(PuntoAndamentoDto::numero).containsExactly(0L, 5L, 0L);

        // Settimane dal lunedì: il 2026-09-03 è un giovedì, la prima settimana parte dal 31 agosto.
        List<PuntoAndamentoDto> settimane = StatisticheService.completaAndamento(Map.of(),
                LocalDate.of(2026, 9, 3), LocalDate.of(2026, 9, 20), GranularitaAndamento.SETTIMANA);
        assertThat(settimane).extracting(PuntoAndamentoDto::periodo).containsExactly(
                LocalDate.of(2026, 8, 31), LocalDate.of(2026, 9, 7), LocalDate.of(2026, 9, 14));

        List<PuntoAndamentoDto> mesi = StatisticheService.completaAndamento(Map.of(),
                LocalDate.of(2026, 1, 15), LocalDate.of(2026, 3, 1), GranularitaAndamento.MESE);
        assertThat(mesi).hasSize(3);
    }
}
