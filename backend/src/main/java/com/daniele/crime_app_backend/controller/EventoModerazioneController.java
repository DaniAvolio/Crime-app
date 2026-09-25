package com.daniele.crime_app_backend.controller;

import com.daniele.crime_app_backend.dto.EventoModerazioneDto;
import com.daniele.crime_app_backend.service.EventoModerazioneService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/segnalazioni/{segnalazioneId}/eventi-moderazione")
public class EventoModerazioneController {

    private final EventoModerazioneService eventoModerazioneService;

    public EventoModerazioneController(EventoModerazioneService eventoModerazioneService) {
        this.eventoModerazioneService = eventoModerazioneService;
    }

    @GetMapping
    public List<EventoModerazioneDto> elenca(@PathVariable Long segnalazioneId) {
        return eventoModerazioneService.trovaPerSegnalazione(segnalazioneId);
    }
}
