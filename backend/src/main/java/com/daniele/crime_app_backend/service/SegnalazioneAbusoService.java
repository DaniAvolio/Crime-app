package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.SegnalazioneAbusoDto;
import com.daniele.crime_app_backend.dto.SegnalazioneAbusoRequest;
import com.daniele.crime_app_backend.entity.Segnalazione;
import com.daniele.crime_app_backend.entity.SegnalazioneAbuso;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.exception.ConflittoException;
import com.daniele.crime_app_backend.mapper.SegnalazioneAbusoMapper;
import com.daniele.crime_app_backend.repository.SegnalazioneAbusoRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class SegnalazioneAbusoService {

    private final SegnalazioneAbusoRepository segnalazioneAbusoRepository;
    private final SegnalazioneAbusoMapper segnalazioneAbusoMapper;
    private final SegnalazioneService segnalazioneService;
    private final UtenteCorrenteService utenteCorrenteService;
    private final int sogliaAbusi;

    public SegnalazioneAbusoService(SegnalazioneAbusoRepository segnalazioneAbusoRepository,
                                     SegnalazioneAbusoMapper segnalazioneAbusoMapper,
                                     SegnalazioneService segnalazioneService,
                                     UtenteCorrenteService utenteCorrenteService,
                                     @Value("${crimeapp.moderazione.soglia-abusi:5}") int sogliaAbusi) {
        this.segnalazioneAbusoRepository = segnalazioneAbusoRepository;
        this.segnalazioneAbusoMapper = segnalazioneAbusoMapper;
        this.segnalazioneService = segnalazioneService;
        this.utenteCorrenteService = utenteCorrenteService;
        this.sogliaAbusi = sogliaAbusi;
    }

    public List<SegnalazioneAbusoDto> trovaPerSegnalazione(Long segnalazioneId) {
        return segnalazioneAbusoRepository.findBySegnalazioneId(segnalazioneId).stream()
                .map(segnalazioneAbusoMapper::toDto)
                .toList();
    }

    /**
     * Un utente può segnalare abuso una sola volta per Segnalazione (vincolo di
     * unicità a livello DB). Al raggiungimento della soglia configurata, la
     * Segnalazione viene sospesa automaticamente (vedi SegnalazioneService).
     */
    @Transactional
    public SegnalazioneAbusoDto segnala(Long segnalazioneId, SegnalazioneAbusoRequest request) {
        Segnalazione segnalazione = segnalazioneService.recuperaOLancia(segnalazioneId);
        Utente utente = utenteCorrenteService.utenteCorrente();

        if (segnalazioneAbusoRepository.existsBySegnalazioneIdAndUtenteId(segnalazioneId, utente.getId())) {
            throw new ConflittoException("Hai già segnalato un abuso per questa segnalazione");
        }

        SegnalazioneAbuso abuso = segnalazioneAbusoRepository.save(SegnalazioneAbuso.builder()
                .segnalazione(segnalazione)
                .utente(utente)
                .motivo(request.motivo())
                .build());

        long numeroAbusi = segnalazioneAbusoRepository.countBySegnalazioneId(segnalazioneId);
        if (numeroAbusi >= sogliaAbusi) {
            segnalazioneService.sospendiAutomaticamente(segnalazioneId,
                    "Soglia di segnalazioni di abuso raggiunta (" + numeroAbusi + ")");
        }

        return segnalazioneAbusoMapper.toDto(abuso);
    }
}
