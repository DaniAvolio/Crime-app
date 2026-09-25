package com.daniele.crime_app_backend.controller;

import com.daniele.crime_app_backend.dto.PreferenzeNotificaDto;
import com.daniele.crime_app_backend.dto.PreferenzeNotificaRequest;
import com.daniele.crime_app_backend.service.PreferenzeNotificaService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/utenti/{utenteId}/preferenze-notifica")
public class PreferenzeNotificaController {

    private final PreferenzeNotificaService preferenzeNotificaService;

    public PreferenzeNotificaController(PreferenzeNotificaService preferenzeNotificaService) {
        this.preferenzeNotificaService = preferenzeNotificaService;
    }

    @GetMapping
    public PreferenzeNotificaDto trova(@PathVariable Long utenteId) {
        return preferenzeNotificaService.trovaPerUtente(utenteId);
    }

    @PutMapping
    public PreferenzeNotificaDto aggiorna(@PathVariable Long utenteId, @Valid @RequestBody PreferenzeNotificaRequest request) {
        return preferenzeNotificaService.aggiornaOCrea(utenteId, request);
    }
}
