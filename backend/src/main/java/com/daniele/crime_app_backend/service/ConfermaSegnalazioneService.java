package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.ConfermaSegnalazioneRequest;
import com.daniele.crime_app_backend.dto.SegnalazioneDto;
import com.daniele.crime_app_backend.entity.ConfermaSegnalazione;
import com.daniele.crime_app_backend.entity.Segnalazione;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;
import com.daniele.crime_app_backend.exception.ConflittoException;
import com.daniele.crime_app_backend.mapper.SegnalazioneMapper;
import com.daniele.crime_app_backend.repository.ConfermaSegnalazioneRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class ConfermaSegnalazioneService {

    private final ConfermaSegnalazioneRepository confermaSegnalazioneRepository;
    private final SegnalazioneService segnalazioneService;
    private final SegnalazioneMapper segnalazioneMapper;
    private final UtenteCorrenteService utenteCorrenteService;
    private final int sogliaNonInAtto;

    public ConfermaSegnalazioneService(ConfermaSegnalazioneRepository confermaSegnalazioneRepository,
                                        SegnalazioneService segnalazioneService,
                                        SegnalazioneMapper segnalazioneMapper,
                                        UtenteCorrenteService utenteCorrenteService,
                                        @Value("${crimeapp.segnalazioni.soglia-non-in-atto:3}") int sogliaNonInAtto) {
        this.confermaSegnalazioneRepository = confermaSegnalazioneRepository;
        this.segnalazioneService = segnalazioneService;
        this.segnalazioneMapper = segnalazioneMapper;
        this.utenteCorrenteService = utenteCorrenteService;
        this.sogliaNonInAtto = sogliaNonInAtto;
    }

    /**
     * Un voto per utente per Segnalazione, modificabile. Un "sì" prolunga la
     * scadenza e azzera il conteggio dei "no"; al raggiungimento della soglia di
     * "no" successivi all'ultimo "sì" la Segnalazione passa in SCADUTA.
     * Ripetere lo stesso voto non ha effetto, così un "sì" ripetuto non prolunga
     * la scadenza all'infinito.
     */
    @Transactional
    public SegnalazioneDto vota(Long segnalazioneId, ConfermaSegnalazioneRequest request) {
        Segnalazione segnalazione = segnalazioneService.recuperaOLancia(segnalazioneId);
        Utente utente = utenteCorrenteService.utenteCorrente();
        boolean ancoraInAtto = request.ancoraInAtto();

        if (segnalazione.getStato() != StatoSegnalazione.ATTIVA) {
            throw new ConflittoException("Impossibile confermare una segnalazione in stato " + segnalazione.getStato());
        }

        LocalDateTime inizioConteggio = segnalazione.getDataUltimaConferma() != null
                ? segnalazione.getDataUltimaConferma()
                : segnalazione.getDataCreazione();

        // Un "no" anteriore all'ultimo "sì" non conta più: ripeterlo lo rinnova.
        Optional<ConfermaSegnalazione> esistente =
                confermaSegnalazioneRepository.findBySegnalazioneIdAndUtenteId(segnalazioneId, utente.getId());
        if (esistente.isPresent() && esistente.get().isAncoraInAtto() == ancoraInAtto
                && (ancoraInAtto || esistente.get().getDataVoto().isAfter(inizioConteggio))) {
            return segnalazioneMapper.toDto(segnalazione);
        }

        ConfermaSegnalazione conferma = esistente.orElseGet(() -> ConfermaSegnalazione.builder()
                .segnalazione(segnalazione)
                .utente(utente)
                .build());
        conferma.setAncoraInAtto(ancoraInAtto);
        conferma.setDataVoto(LocalDateTime.now());
        confermaSegnalazioneRepository.save(conferma);

        if (ancoraInAtto) {
            segnalazioneService.prolungaScadenza(segnalazione);
        } else {
            long numeroNonInAtto = confermaSegnalazioneRepository
                    .countBySegnalazioneIdAndAncoraInAttoFalseAndDataVotoAfter(segnalazioneId, inizioConteggio);
            if (numeroNonInAtto >= sogliaNonInAtto) {
                segnalazioneService.scadiPerConfermeNegative(segnalazione,
                        "Segnalata come non più in atto da " + numeroNonInAtto + " utenti");
            }
        }

        return segnalazioneMapper.toDto(segnalazione);
    }
}
