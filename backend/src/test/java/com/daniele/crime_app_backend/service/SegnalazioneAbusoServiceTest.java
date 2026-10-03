package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.SegnalazioneAbusoRequest;
import com.daniele.crime_app_backend.entity.Segnalazione;
import com.daniele.crime_app_backend.entity.SegnalazioneAbuso;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.entity.enums.MotivoAbuso;
import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;
import com.daniele.crime_app_backend.exception.AccessoNegatoException;
import com.daniele.crime_app_backend.exception.ConflittoException;
import com.daniele.crime_app_backend.mapper.SegnalazioneAbusoMapper;
import com.daniele.crime_app_backend.repository.SegnalazioneAbusoRepository;
import com.daniele.crime_app_backend.repository.SegnalazioneRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SegnalazioneAbusoServiceTest {

    private static final BigDecimal SOGLIA = new BigDecimal("4.0");

    @Mock
    private SegnalazioneAbusoRepository abusoRepository;
    @Mock
    private SegnalazioneRepository segnalazioneRepository;
    @Mock
    private SegnalazioneAbusoMapper mapper;
    @Mock
    private SegnalazioneService segnalazioneService;
    @Mock
    private UtenteCorrenteService utenteCorrenteService;

    private final Utente autore = Utente.builder().id(1L).punteggioFiducia(100).build();
    private Segnalazione segnalazione;

    @BeforeEach
    void prepara() {
        segnalazione = Segnalazione.builder().id(10L).autore(autore).stato(StatoSegnalazione.ATTIVA).build();
        lenient().when(segnalazioneService.recuperaOLancia(10L)).thenReturn(segnalazione);
    }

    private SegnalazioneAbusoService service() {
        return new SegnalazioneAbusoService(abusoRepository, segnalazioneRepository, mapper, segnalazioneService,
                utenteCorrenteService, SOGLIA);
    }

    private void segnalaCome(Utente utente) {
        when(utenteCorrenteService.utenteCorrente()).thenReturn(utente);
        service().segnala(10L, new SegnalazioneAbusoRequest(MotivoAbuso.OFFENSIVA, "  insulti  "));
    }

    @Test
    void ilPesoSegueLaFiduciaConUnMinimo() {
        assertThat(SegnalazioneAbusoService.peso(Utente.builder().punteggioFiducia(100).build()))
                .isEqualByComparingTo("1");
        assertThat(SegnalazioneAbusoService.peso(Utente.builder().punteggioFiducia(60).build()))
                .isEqualByComparingTo("0.6");
        assertThat(SegnalazioneAbusoService.peso(Utente.builder().punteggioFiducia(5).build()))
                .isEqualByComparingTo("0.25");
    }

    @Test
    void sottoSogliaEntraSoloInCoda() {
        when(abusoRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(segnalazioneRepository.pesoAbusi(10L)).thenReturn(new BigDecimal("3.60"));

        segnalaCome(Utente.builder().id(2L).punteggioFiducia(60).build());

        ArgumentCaptor<SegnalazioneAbuso> salvato = ArgumentCaptor.forClass(SegnalazioneAbuso.class);
        verify(abusoRepository).save(salvato.capture());
        assertThat(salvato.getValue().getNota()).isEqualTo("insulti");
        assertThat(salvato.getValue().getPeso()).isEqualByComparingTo("0.6");
        verify(segnalazioneRepository).registraAbuso(eq(10L), eq(new BigDecimal("0.60")));
        verify(segnalazioneService, never()).sospendiAutomaticamente(anyLong(), anyString());
    }

    @Test
    void allaSogliaDiPesoLaSegnalazioneVieneSospesa() {
        when(abusoRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(segnalazioneRepository.pesoAbusi(10L)).thenReturn(new BigDecimal("4.00"));

        segnalaCome(Utente.builder().id(2L).punteggioFiducia(100).build());

        verify(segnalazioneService).sospendiAutomaticamente(eq(10L), anyString());
    }

    @Test
    void lAutoreNonPuoSegnalareLaPropria() {
        when(utenteCorrenteService.utenteCorrente()).thenReturn(autore);
        assertThatThrownBy(() -> service().segnala(10L, new SegnalazioneAbusoRequest(MotivoAbuso.SPAM, null)))
                .isInstanceOf(AccessoNegatoException.class);
        verify(abusoRepository, never()).save(any());
    }

    @Test
    void soloSuSegnalazioniAttive() {
        segnalazione.setStato(StatoSegnalazione.SOSPESA);
        when(utenteCorrenteService.utenteCorrente()).thenReturn(Utente.builder().id(2L).build());
        assertThatThrownBy(() -> service().segnala(10L, new SegnalazioneAbusoRequest(MotivoAbuso.SPAM, null)))
                .isInstanceOf(ConflittoException.class);
    }

    @Test
    void unaSolaVoltaPerUtente() {
        when(utenteCorrenteService.utenteCorrente()).thenReturn(Utente.builder().id(2L).build());
        when(abusoRepository.existsBySegnalazioneIdAndUtenteId(10L, 2L)).thenReturn(true);
        assertThatThrownBy(() -> service().segnala(10L, new SegnalazioneAbusoRequest(MotivoAbuso.SPAM, null)))
                .isInstanceOf(ConflittoException.class);
    }
}
