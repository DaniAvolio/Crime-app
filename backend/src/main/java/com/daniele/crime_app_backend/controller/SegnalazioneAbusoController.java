package com.daniele.crime_app_backend.controller;

import com.daniele.crime_app_backend.dto.SegnalazioneAbusoDto;
import com.daniele.crime_app_backend.dto.SegnalazioneAbusoRequest;
import com.daniele.crime_app_backend.service.SegnalazioneAbusoService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/segnalazioni/{segnalazioneId}/abusi")
public class SegnalazioneAbusoController {

    private final SegnalazioneAbusoService segnalazioneAbusoService;

    public SegnalazioneAbusoController(SegnalazioneAbusoService segnalazioneAbusoService) {
        this.segnalazioneAbusoService = segnalazioneAbusoService;
    }

    @GetMapping
    public List<SegnalazioneAbusoDto> elenca(@PathVariable Long segnalazioneId) {
        return segnalazioneAbusoService.trovaPerSegnalazione(segnalazioneId);
    }

    @PostMapping
    public ResponseEntity<SegnalazioneAbusoDto> segnala(@PathVariable Long segnalazioneId,
                                                          @Valid @RequestBody SegnalazioneAbusoRequest request) {
        SegnalazioneAbusoDto creato = segnalazioneAbusoService.segnala(segnalazioneId, request);
        return ResponseEntity.created(URI.create("/api/segnalazioni/" + segnalazioneId + "/abusi/" + creato.id()))
                .body(creato);
    }
}
