package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.PreferenzeNotificaRequest;
import com.daniele.crime_app_backend.dto.ZonaNotificaRequest;
import com.daniele.crime_app_backend.entity.Categoria;
import com.daniele.crime_app_backend.entity.PreferenzeNotifica;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.exception.RichiestaNonValidaException;
import com.daniele.crime_app_backend.exception.RisorsaNonTrovataException;
import com.daniele.crime_app_backend.mapper.SegnalazioneMapper;
import com.daniele.crime_app_backend.repository.CategoriaRepository;
import com.daniele.crime_app_backend.repository.PreferenzeNotificaRepository;
import com.daniele.crime_app_backend.repository.ZonaNotificaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ZoneEPreferenzeNotificaTest {

    @Mock
    private ZonaNotificaRepository zonaRepository;
    @Mock
    private PreferenzeNotificaRepository preferenzeRepository;
    @Mock
    private CategoriaRepository categoriaRepository;
    @Mock
    private UtenteCorrenteService utenteCorrenteService;

    private final Utente utente = Utente.builder().id(7L).build();

    private ZoneNotificaService zone() {
        return new ZoneNotificaService(zonaRepository, new SegnalazioneMapper(utenteCorrenteService), utenteCorrenteService);
    }

    private PreferenzeNotificaService preferenze() {
        return new PreferenzeNotificaService(preferenzeRepository, categoriaRepository, utenteCorrenteService);
    }

    @Test
    void alMassimoCinqueZone() {
        when(utenteCorrenteService.idCorrente()).thenReturn(7L);
        when(zonaRepository.countByUtenteId(7L)).thenReturn(5L);

        assertThatThrownBy(() -> zone().crea(new ZonaNotificaRequest("Palestra", 45.07, 7.68, 1000)))
                .isInstanceOf(RichiestaNonValidaException.class);
        verify(zonaRepository, never()).save(any());
    }

    @Test
    void laZonaDiUnAltroNonSiTocca() {
        when(utenteCorrenteService.idCorrente()).thenReturn(7L);
        when(zonaRepository.findByIdAndUtenteId(3L, 7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> zone().elimina(3L)).isInstanceOf(RisorsaNonTrovataException.class);
    }

    @Test
    void oreDiSilenzioVannoIndicateEntrambeEDiverse() {
        assertThatThrownBy(() -> preferenze().aggiornaOCrea(new PreferenzeNotificaRequest(true, 3, List.of(),
                LocalTime.of(23, 0), null, true, true))).isInstanceOf(RichiestaNonValidaException.class);
        assertThatThrownBy(() -> preferenze().aggiornaOCrea(new PreferenzeNotificaRequest(true, 3, List.of(),
                LocalTime.of(23, 0), LocalTime.of(23, 0), true, true))).isInstanceOf(RichiestaNonValidaException.class);
    }

    @Test
    void categorieInesistentiRifiutate() {
        when(categoriaRepository.findAllById(List.of(1L, 99L))).thenReturn(List.of(Categoria.builder().id(1L).build()));

        assertThatThrownBy(() -> preferenze().aggiornaOCrea(new PreferenzeNotificaRequest(true, 2, List.of(1L, 99L),
                null, null, true, true))).isInstanceOf(RichiestaNonValidaException.class);
    }

    @Test
    void primoSalvataggioCreaLePreferenze() {
        when(categoriaRepository.findAllById(List.of(4L))).thenReturn(List.of(Categoria.builder().id(4L).build()));
        when(utenteCorrenteService.utenteCorrente()).thenReturn(utente);
        when(preferenzeRepository.findByUtenteId(7L)).thenReturn(Optional.empty());
        when(preferenzeRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        var dto = preferenze().aggiornaOCrea(new PreferenzeNotificaRequest(true, 2, List.of(4L, 4L),
                LocalTime.of(23, 0), LocalTime.of(7, 0), false, true));

        assertThat(dto.gravitaMinima()).isEqualTo(2);
        assertThat(dto.categorieId()).containsExactly(4L);
        assertThat(dto.oreSilenzioDa()).isEqualTo(LocalTime.of(23, 0));
        assertThat(dto.graviInSilenzio()).isFalse();
    }

    @Test
    void senzaPreferenzeSalvateValgonoIDefault() {
        when(utenteCorrenteService.idCorrente()).thenReturn(7L);
        when(preferenzeRepository.findByUtenteId(7L)).thenReturn(Optional.empty());

        var dto = preferenze().trovaPerUtenteCorrente();

        assertThat(dto.notificheAttive()).isTrue();
        assertThat(dto.gravitaMinima()).isEqualTo(3);
        assertThat(dto.categorieId()).isEmpty();
        assertThat(dto.oreSilenzioDa()).isNull();
        assertThat(PreferenzeNotifica.builder().build().isAggiornamentiMie()).isTrue();
    }
}
