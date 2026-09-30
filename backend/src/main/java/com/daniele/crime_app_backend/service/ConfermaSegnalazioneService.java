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
import com.daniele.crime_app_backend.repository.UtenteRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Objects;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class ConfermaSegnalazioneService {

    private final ConfermaSegnalazioneRepository confermaSegnalazioneRepository;
    private final SegnalazioneService segnalazioneService;
    private final SegnalazioneMapper segnalazioneMapper;
    private final UtenteCorrenteService utenteCorrenteService;
    private final UtenteRepository utenteRepository;
    private final int sogliaNonInAtto;

    public ConfermaSegnalazioneService(ConfermaSegnalazioneRepository confermaSegnalazioneRepository,
                                        SegnalazioneService segnalazioneService,
                                        SegnalazioneMapper segnalazioneMapper,
                                        UtenteCorrenteService utenteCorrenteService,
                                        UtenteRepository utenteRepository,
                                        @Value("${crimeapp.segnalazioni.soglia-non-in-atto:3}") int sogliaNonInAtto) {
        this.confermaSegnalazioneRepository = confermaSegnalazioneRepository;
        this.segnalazioneService = segnalazioneService;
        this.segnalazioneMapper = segnalazioneMapper;
        this.utenteCorrenteService = utenteCorrenteService;
        this.utenteRepository = utenteRepository;
        this.sogliaNonInAtto = sogliaNonInAtto;
    }

    /**
     * Un voto per utente per Segnalazione, modificabile. Un "sì" prolunga la
     * scadenza e azzera il conteggio dei "no"; al raggiungimento della soglia di
     * "no" successivi all'ultimo "sì" la Segnalazione passa in SCADUTA.
     * Ripetere lo stesso voto non ha effetto, così un "sì" ripetuto non prolunga
     * la scadenza all'infinito. Un "no" dell'autore conclude subito la Segnalazione.
     * Un utente prolunga al massimo una volta per durata della categoria: un suo "sì" più
     * ravvicinato (es. dopo un No -> Sì) aggiorna il voto ma non prolunga né azzera i "no".
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
            return segnalazioneMapper.toDto(segnalazione, ancoraInAtto);
        }

        ConfermaSegnalazione conferma = esistente.orElseGet(() -> ConfermaSegnalazione.builder()
                .segnalazione(segnalazione)
                .utente(utente)
                .build());
        LocalDateTime adesso = LocalDateTime.now();
        boolean prolunga = ancoraInAtto && puoProlungare(conferma, segnalazione, adesso);
        Long autoreId = segnalazione.getAutore() != null ? segnalazione.getAutore().getId() : null;
        boolean votaAutore = Objects.equals(autoreId, utente.getId());
        // Primo "sì" di un altro utente: la segnalazione diventa "confermata" per l'autore. Si
        // controlla prima di salvare il voto, così il "sì" appena dato non conta come precedente.
        boolean primaConfermaAltrui = prolunga && autoreId != null && !votaAutore
                && !confermaSegnalazioneRepository
                        .existsBySegnalazioneIdAndUtenteIdNotAndDataUltimoSiIsNotNull(segnalazioneId, autoreId);
        conferma.setAncoraInAtto(ancoraInAtto);
        conferma.setDataVoto(adesso);
        if (prolunga) {
            conferma.setDataUltimoSi(adesso);
        }
        confermaSegnalazioneRepository.save(conferma);

        if (ancoraInAtto) {
            // Un "sì" troppo ravvicinato al precedente dello stesso utente vale solo come voto.
            if (prolunga) {
                segnalazioneService.prolungaScadenza(segnalazione);
            }
            if (primaConfermaAltrui) {
                utenteRepository.incrementaSegnalazioniConfermate(autoreId);
            }
        } else if (votaAutore) {
            segnalazioneService.concludiDaAutore(segnalazione);
        } else {
            long numeroNonInAtto = confermaSegnalazioneRepository
                    .countBySegnalazioneIdAndAncoraInAttoFalseAndDataVotoAfter(segnalazioneId, inizioConteggio);
            if (numeroNonInAtto >= sogliaNonInAtto) {
                segnalazioneService.scadiPerConfermeNegative(segnalazione,
                        "Segnalata come non più in atto da " + numeroNonInAtto + " utenti");
            }
        }

        return segnalazioneMapper.toDto(segnalazione, ancoraInAtto);
    }

    /** Primo "sì" dell'utente, o il precedente risale a più di una durata della categoria fa. */
    private static boolean puoProlungare(ConfermaSegnalazione conferma, Segnalazione segnalazione,
                                         LocalDateTime adesso) {
        LocalDateTime ultimoSi = conferma.getDataUltimoSi();
        return ultimoSi == null
                || ultimoSi.isBefore(adesso.minusHours(segnalazione.getCategoria().getDurataValiditaOre()));
    }
}
