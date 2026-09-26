package com.daniele.crime_app_backend.controller;

import com.daniele.crime_app_backend.dto.ConfermaSegnalazioneRequest;
import com.daniele.crime_app_backend.dto.SegnalazioneDto;
import com.daniele.crime_app_backend.service.ConfermaSegnalazioneService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/segnalazioni/{segnalazioneId}/conferme")
public class ConfermaSegnalazioneController {

    private final ConfermaSegnalazioneService confermaSegnalazioneService;

    public ConfermaSegnalazioneController(ConfermaSegnalazioneService confermaSegnalazioneService) {
        this.confermaSegnalazioneService = confermaSegnalazioneService;
    }

    /** Restituisce la Segnalazione aggiornata (nuova scadenza o stato SCADUTA). */
    @PostMapping
    public SegnalazioneDto vota(@PathVariable Long segnalazioneId,
                                 @Valid @RequestBody ConfermaSegnalazioneRequest request) {
        return confermaSegnalazioneService.vota(segnalazioneId, request);
    }
}
