package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.PreferenzeNotificaDto;
import com.daniele.crime_app_backend.dto.PreferenzeNotificaRequest;
import com.daniele.crime_app_backend.entity.PreferenzeNotifica;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.mapper.PreferenzeNotificaMapper;
import com.daniele.crime_app_backend.repository.PreferenzeNotificaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PreferenzeNotificaService {

    private final PreferenzeNotificaRepository preferenzeNotificaRepository;
    private final PreferenzeNotificaMapper preferenzeNotificaMapper;
    private final UtenteCorrenteService utenteCorrenteService;

    public PreferenzeNotificaService(PreferenzeNotificaRepository preferenzeNotificaRepository,
                                      PreferenzeNotificaMapper preferenzeNotificaMapper,
                                      UtenteCorrenteService utenteCorrenteService) {
        this.preferenzeNotificaRepository = preferenzeNotificaRepository;
        this.preferenzeNotificaMapper = preferenzeNotificaMapper;
        this.utenteCorrenteService = utenteCorrenteService;
    }

    /** Le preferenze di default (vedi PreferenzeNotifica) valgono finché l'utente non le personalizza. */
    public PreferenzeNotificaDto trovaPerUtenteCorrente() {
        Utente utente = utenteCorrenteService.utenteCorrente();
        return preferenzeNotificaRepository.findByUtenteId(utente.getId())
                .map(preferenzeNotificaMapper::toDto)
                .orElseGet(() -> preferenzeNotificaMapper.toDto(PreferenzeNotifica.builder().utente(utente).build()));
    }

    /** Upsert: crea le preferenze se l'utente non le ha ancora mai salvate, altrimenti le aggiorna. */
    @Transactional
    public PreferenzeNotificaDto aggiornaOCrea(PreferenzeNotificaRequest request) {
        Utente utente = utenteCorrenteService.utenteCorrente();
        PreferenzeNotifica preferenze = preferenzeNotificaRepository.findByUtenteId(utente.getId())
                .orElse(null);
        if (preferenze == null) {
            preferenze = preferenzeNotificaMapper.toEntity(utente, request);
            return preferenzeNotificaMapper.toDto(preferenzeNotificaRepository.save(preferenze));
        }
        preferenzeNotificaMapper.aggiornaEntity(preferenze, request);
        return preferenzeNotificaMapper.toDto(preferenze);
    }
}
