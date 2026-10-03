package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.EsitoRevisioneRequest;
import com.daniele.crime_app_backend.entity.Segnalazione;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.entity.enums.EsitoAbuso;
import com.daniele.crime_app_backend.entity.enums.RuoloUtente;
import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;
import com.daniele.crime_app_backend.exception.ConflittoException;
import com.daniele.crime_app_backend.mapper.SegnalazioneMapper;
import com.daniele.crime_app_backend.repository.ConfermaSegnalazioneRepository;
import com.daniele.crime_app_backend.repository.EventoModerazioneRepository;
import com.daniele.crime_app_backend.repository.SegnalazioneAbusoRepository;
import com.daniele.crime_app_backend.repository.SegnalazioneRepository;
import com.daniele.crime_app_backend.repository.UtenteRepository;
import com.daniele.crime_app_backend.service.moderazione.ValidatoreDescrizione;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Decisioni dell'admin sulla coda "da rivedere": stato, esito degli abusi e fiducia. */
@ExtendWith(MockitoExtension.class)
class SegnalazioneServiceRevisioneTest {

    @Mock
    private SegnalazioneRepository segnalazioneRepository;
    @Mock
    private EventoModerazioneRepository eventoRepository;
    @Mock
    private ConfermaSegnalazioneRepository confermaRepository;
    @Mock
    private SegnalazioneAbusoRepository abusoRepository;
    @Mock
    private SegnalazioneMapper mapper;
    @Mock
    private CategoriaService categoriaService;
    @Mock
    private UtenteCorrenteService utenteCorrenteService;
    @Mock
    private UtenteRepository utenteRepository;
    @Mock
    private ValidatoreDescrizione validatore;
    @Mock
    private org.springframework.context.ApplicationEventPublisher eventi;

    private final Utente admin = Utente.builder().id(9L).ruolo(RuoloUtente.ADMIN).build();
    private final Utente autore = Utente.builder().id(1L).ruolo(RuoloUtente.UTENTE).build();
    private Segnalazione segnalazione;

    @BeforeEach
    void prepara() {
        segnalazione = Segnalazione.builder().id(10L).autore(autore).stato(StatoSegnalazione.SOSPESA)
                .daRivedere(true).numeroAbusi(4).pesoAbusi(new BigDecimal("4.00")).build();
        when(segnalazioneRepository.findById(10L)).thenReturn(Optional.of(segnalazione));
        when(utenteCorrenteService.utenteCorrente()).thenReturn(admin);
    }

    private SegnalazioneService service() {
        return new SegnalazioneService(segnalazioneRepository, eventoRepository, confermaRepository, abusoRepository,
                mapper, categoriaService, utenteCorrenteService, utenteRepository, validatore, eventi);
    }

    @Test
    void abusiInfondatiRiattivanoEPenalizzanoISegnalanti() {
        when(abusoRepository.segnalantiInAttesa(10L)).thenReturn(List.of(2L, 3L));

        service().decidiRevisione(10L, new EsitoRevisioneRequest(EsitoAbuso.INFONDATO, null));

        assertThat(segnalazione.getStato()).isEqualTo(StatoSegnalazione.ATTIVA);
        assertThat(segnalazione.isDaRivedere()).isFalse();
        verify(abusoRepository).registraEsito(eq(10L), eq(EsitoAbuso.INFONDATO), any());
        verify(utenteRepository).modificaFiducia(List.of(2L, 3L), SegnalazioneService.FIDUCIA_ABUSO_INFONDATO);
        verify(segnalazioneRepository).chiudiRevisione(10L);
        verify(utenteRepository, never()).incrementaSegnalazioniRimosse(any());
    }

    @Test
    void abusiFondatiRimuovonoPremianoISegnalantiEPenalizzanoLAutore() {
        when(abusoRepository.segnalantiInAttesa(10L)).thenReturn(List.of(2L));

        service().decidiRevisione(10L, new EsitoRevisioneRequest(EsitoAbuso.FONDATO, null));

        assertThat(segnalazione.getStato()).isEqualTo(StatoSegnalazione.RIMOSSA);
        assertThat(segnalazione.getDataRimozione()).isNotNull();
        verify(abusoRepository).registraEsito(eq(10L), eq(EsitoAbuso.FONDATO), any());
        verify(utenteRepository).modificaFiducia(List.of(2L), SegnalazioneService.FIDUCIA_ABUSO_FONDATO);
        verify(utenteRepository).modificaFiducia(List.of(1L), SegnalazioneService.FIDUCIA_AUTORE_RIMOSSA);
        verify(utenteRepository).incrementaSegnalazioniRimosse(1L);
    }

    @Test
    void soloControlliAutomaticiEsceDallaCodaSenzaToccareLaFiducia() {
        segnalazione.setStato(StatoSegnalazione.ATTIVA);
        when(abusoRepository.segnalantiInAttesa(10L)).thenReturn(List.of());

        service().decidiRevisione(10L, new EsitoRevisioneRequest(EsitoAbuso.INFONDATO, null));

        assertThat(segnalazione.getStato()).isEqualTo(StatoSegnalazione.ATTIVA);
        verify(segnalazioneRepository).chiudiRevisione(10L);
        verify(utenteRepository, never()).modificaFiducia(any(), anyInt());
    }

    @Test
    void unaSegnalazioneFuoriCodaNonSiDecide() {
        segnalazione.setDaRivedere(false);
        assertThatThrownBy(() -> service().decidiRevisione(10L, new EsitoRevisioneRequest(EsitoAbuso.FONDATO, null)))
                .isInstanceOf(ConflittoException.class);
    }
}
