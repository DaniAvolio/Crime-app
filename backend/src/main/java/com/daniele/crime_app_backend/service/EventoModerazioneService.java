package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.EventoModerazioneDto;
import com.daniele.crime_app_backend.mapper.EventoModerazioneMapper;
import com.daniele.crime_app_backend.repository.EventoModerazioneRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Sola lettura: gli EventoModerazione sono creati internamente da SegnalazioneService ad ogni transizione di stato. */
@Service
@Transactional(readOnly = true)
public class EventoModerazioneService {

    private final EventoModerazioneRepository eventoModerazioneRepository;
    private final EventoModerazioneMapper eventoModerazioneMapper;

    public EventoModerazioneService(EventoModerazioneRepository eventoModerazioneRepository,
                                     EventoModerazioneMapper eventoModerazioneMapper) {
        this.eventoModerazioneRepository = eventoModerazioneRepository;
        this.eventoModerazioneMapper = eventoModerazioneMapper;
    }

    public List<EventoModerazioneDto> trovaPerSegnalazione(Long segnalazioneId) {
        return eventoModerazioneRepository.findBySegnalazioneIdOrderByDataEventoDesc(segnalazioneId).stream()
                .map(eventoModerazioneMapper::toDto)
                .toList();
    }
}
