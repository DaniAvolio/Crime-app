package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.ConfermaSegnalazioneRequest;
import com.daniele.crime_app_backend.entity.Categoria;
import com.daniele.crime_app_backend.entity.ConfermaSegnalazione;
import com.daniele.crime_app_backend.entity.Segnalazione;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;
import com.daniele.crime_app_backend.mapper.SegnalazioneMapper;
import com.daniele.crime_app_backend.repository.ConfermaSegnalazioneRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConfermaSegnalazioneServiceTest {

    private static final int SOGLIA = 3;

    @Mock
    private ConfermaSegnalazioneRepository confermaRepository;
    @Mock
    private SegnalazioneService segnalazioneService;
    @Mock
    private SegnalazioneMapper segnalazioneMapper;
    @Mock
    private UtenteCorrenteService utenteCorrenteService;

    private final Utente autore = Utente.builder().id(1L).build();
    private final Utente passante = Utente.builder().id(2L).build();
    private Segnalazione segnalazione;

    @BeforeEach
    void prepara() {
        segnalazione = Segnalazione.builder()
                .id(10L)
                .autore(autore)
                .categoria(Categoria.builder().id(1L).durataValiditaOre(6).build())
                .stato(StatoSegnalazione.ATTIVA)
                .dataCreazione(LocalDateTime.now().minusHours(1))
                .build();
        when(segnalazioneService.recuperaOLancia(10L)).thenReturn(segnalazione);
        when(confermaRepository.findBySegnalazioneIdAndUtenteId(eq(10L), any())).thenReturn(Optional.empty());
    }

    private ConfermaSegnalazioneService service() {
        return new ConfermaSegnalazioneService(confermaRepository, segnalazioneService, segnalazioneMapper,
                utenteCorrenteService, SOGLIA);
    }

    @Test
    void ilNoDellAutoreConcludeSubitoLaSegnalazione() {
        when(utenteCorrenteService.utenteCorrente()).thenReturn(autore);

        service().vota(10L, new ConfermaSegnalazioneRequest(false));

        verify(confermaRepository).save(any(ConfermaSegnalazione.class));
        verify(segnalazioneService).concludiDaAutore(segnalazione);
        verify(segnalazioneService, never()).scadiPerConfermeNegative(any(), anyString());
    }

    @Test
    void ilNoDiUnAltroUtenteSottoSogliaNonChiude() {
        when(utenteCorrenteService.utenteCorrente()).thenReturn(passante);
        when(confermaRepository.countBySegnalazioneIdAndAncoraInAttoFalseAndDataVotoAfter(eq(10L), any()))
                .thenReturn((long) SOGLIA - 1);

        service().vota(10L, new ConfermaSegnalazioneRequest(false));

        verify(segnalazioneService, never()).concludiDaAutore(any());
        verify(segnalazioneService, never()).scadiPerConfermeNegative(any(), anyString());
    }

    @Test
    void allaSogliaDiNoLaSegnalazioneScade() {
        when(utenteCorrenteService.utenteCorrente()).thenReturn(passante);
        when(confermaRepository.countBySegnalazioneIdAndAncoraInAttoFalseAndDataVotoAfter(eq(10L), any()))
                .thenReturn((long) SOGLIA);

        service().vota(10L, new ConfermaSegnalazioneRequest(false));

        verify(segnalazioneService).scadiPerConfermeNegative(eq(segnalazione), anyString());
        verify(segnalazioneService, never()).concludiDaAutore(any());
    }

    @Test
    void unSiRavvicinatoDopoUnNoNonProlungaDiNuovo() {
        when(utenteCorrenteService.utenteCorrente()).thenReturn(passante);
        when(confermaRepository.findBySegnalazioneIdAndUtenteId(10L, 2L)).thenReturn(Optional.of(votoPrecedente(2)));

        service().vota(10L, new ConfermaSegnalazioneRequest(true));

        verify(confermaRepository).save(any(ConfermaSegnalazione.class));
        verify(segnalazioneService, never()).prolungaScadenza(any());
    }

    @Test
    void unSiDopoLaDurataDellaCategoriaProlungaDiNuovo() {
        when(utenteCorrenteService.utenteCorrente()).thenReturn(passante);
        when(confermaRepository.findBySegnalazioneIdAndUtenteId(10L, 2L)).thenReturn(Optional.of(votoPrecedente(7)));

        service().vota(10L, new ConfermaSegnalazioneRequest(true));

        verify(segnalazioneService).prolungaScadenza(segnalazione);
    }

    /** Il passante aveva detto sì (e prolungato) `oreFa` ore fa, poi ha cambiato in no. */
    private ConfermaSegnalazione votoPrecedente(int oreFa) {
        LocalDateTime ultimoSi = LocalDateTime.now().minusHours(oreFa);
        return ConfermaSegnalazione.builder()
                .segnalazione(segnalazione)
                .utente(passante)
                .ancoraInAtto(false)
                .dataVoto(ultimoSi.plusMinutes(5))
                .dataUltimoSi(ultimoSi)
                .build();
    }

    @Test
    void ilSiDellAutoreProlungaComeGliAltri() {
        when(utenteCorrenteService.utenteCorrente()).thenReturn(autore);

        service().vota(10L, new ConfermaSegnalazioneRequest(true));

        verify(segnalazioneService).prolungaScadenza(segnalazione);
        verify(segnalazioneService, never()).concludiDaAutore(any());
    }
}
