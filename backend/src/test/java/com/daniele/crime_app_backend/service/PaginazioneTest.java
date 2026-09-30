package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.exception.RichiestaNonValidaException;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PaginazioneTest {

    private static final Map<String, String> ORDINABILI = Map.of("categoria", "categoria.nome", "stato", "stato");
    private static final Sort PREDEFINITO = Sort.by(Sort.Order.desc("dataCreazione"));

    @Test
    void senzaOrdinamentoUsaIlPredefinitoPiuIdPerStabilita() {
        Pageable richiesta = Paginazione.crea(1, 25, null, ORDINABILI, PREDEFINITO);
        assertThat(richiesta.getPageNumber()).isEqualTo(1);
        assertThat(richiesta.getPageSize()).isEqualTo(25);
        assertThat(richiesta.getSort()).isEqualTo(PREDEFINITO.and(Sort.by("id")));
    }

    @Test
    void traduceIlCampoEspostoNellaProprietaJpa() {
        Pageable richiesta = Paginazione.crea(0, 10, "categoria,desc", ORDINABILI, PREDEFINITO);
        assertThat(richiesta.getSort()).isEqualTo(Sort.by(Sort.Order.desc("categoria.nome"), Sort.Order.asc("id")));
        assertThat(Paginazione.crea(0, 10, "stato", ORDINABILI, PREDEFINITO).getSort())
                .isEqualTo(Sort.by(Sort.Order.asc("stato"), Sort.Order.asc("id")));
    }

    @Test
    void campoOVersoNonAmmessiSonoRichiesteNonValide() {
        assertThatThrownBy(() -> Paginazione.crea(0, 10, "passwordHash,asc", ORDINABILI, PREDEFINITO))
                .isInstanceOf(RichiestaNonValidaException.class);
        assertThatThrownBy(() -> Paginazione.crea(0, 10, "stato,su", ORDINABILI, PREDEFINITO))
                .isInstanceOf(RichiestaNonValidaException.class);
    }

    @Test
    void senzaOrdinamentoValidaComunquePaginaEDimensione() {
        assertThat(Paginazione.senzaOrdinamento(1, 20).getSort().isUnsorted()).isTrue();
        assertThatThrownBy(() -> Paginazione.senzaOrdinamento(0, Paginazione.DIMENSIONE_MASSIMA + 1))
                .isInstanceOf(RichiestaNonValidaException.class);
    }

    @Test
    void paginaEDimensioneFuoriLimiteSonoRichiesteNonValide() {
        assertThatThrownBy(() -> Paginazione.crea(-1, 10, null, ORDINABILI, PREDEFINITO))
                .isInstanceOf(RichiestaNonValidaException.class);
        assertThatThrownBy(() -> Paginazione.crea(0, 0, null, ORDINABILI, PREDEFINITO))
                .isInstanceOf(RichiestaNonValidaException.class);
        assertThatThrownBy(() -> Paginazione.crea(0, Paginazione.DIMENSIONE_MASSIMA + 1, null, ORDINABILI, PREDEFINITO))
                .isInstanceOf(RichiestaNonValidaException.class);
    }
}
