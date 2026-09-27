package com.daniele.crime_app_backend.controller;

import com.daniele.crime_app_backend.dto.PreferenzeNotificaDto;
import com.daniele.crime_app_backend.dto.PreferenzeNotificaRequest;
import com.daniele.crime_app_backend.service.PreferenzeNotificaService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

/** Preferenze di notifica dell'utente autenticato. */
@RestController
@RequestMapping("/api/utenti/me/preferenze-notifica")
public class PreferenzeNotificaController {

    private final PreferenzeNotificaService preferenzeNotificaService;

    public PreferenzeNotificaController(PreferenzeNotificaService preferenzeNotificaService) {
        this.preferenzeNotificaService = preferenzeNotificaService;
    }

    @GetMapping
    public PreferenzeNotificaDto trova() {
        return preferenzeNotificaService.trovaPerUtenteCorrente();
    }

    @PutMapping
    public PreferenzeNotificaDto aggiorna(@Valid @RequestBody PreferenzeNotificaRequest request) {
        return preferenzeNotificaService.aggiornaOCrea(request);
    }
}
