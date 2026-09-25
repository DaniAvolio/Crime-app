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
    private final UtenteService utenteService;

    public PreferenzeNotificaService(PreferenzeNotificaRepository preferenzeNotificaRepository,
                                      PreferenzeNotificaMapper preferenzeNotificaMapper,
                                      UtenteService utenteService) {
        this.preferenzeNotificaRepository = preferenzeNotificaRepository;
        this.preferenzeNotificaMapper = preferenzeNotificaMapper;
        this.utenteService = utenteService;
    }

    /** Le preferenze di default (vedi PreferenzeNotifica) valgono finché l'utente non le personalizza. */
    public PreferenzeNotificaDto trovaPerUtente(Long utenteId) {
        return preferenzeNotificaRepository.findByUtenteId(utenteId)
                .map(preferenzeNotificaMapper::toDto)
                .orElseGet(() -> preferenzeNotificaMapper.toDto(
                        PreferenzeNotifica.builder().utente(utenteService.recuperaOLancia(utenteId)).build()));
    }

    /** Upsert: crea le preferenze se l'utente non le ha ancora mai salvate, altrimenti le aggiorna. */
    @Transactional
    public PreferenzeNotificaDto aggiornaOCrea(Long utenteId, PreferenzeNotificaRequest request) {
        PreferenzeNotifica preferenze = preferenzeNotificaRepository.findByUtenteId(utenteId)
                .orElse(null);
        if (preferenze == null) {
            Utente utente = utenteService.recuperaOLancia(utenteId);
            preferenze = preferenzeNotificaMapper.toEntity(utente, request);
            return preferenzeNotificaMapper.toDto(preferenzeNotificaRepository.save(preferenze));
        }
        preferenzeNotificaMapper.aggiornaEntity(preferenze, request);
        return preferenzeNotificaMapper.toDto(preferenze);
    }
}
