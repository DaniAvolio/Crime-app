package com.daniele.crime_app_backend.controller;

import com.daniele.crime_app_backend.dto.SegnalazioneDto;
import com.daniele.crime_app_backend.dto.SegnalazioneRequest;
import com.daniele.crime_app_backend.dto.SegnalazioneTransizioneRequest;
import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;
import com.daniele.crime_app_backend.service.SegnalazioneService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/segnalazioni")
public class SegnalazioneController {

    private final SegnalazioneService segnalazioneService;

    public SegnalazioneController(SegnalazioneService segnalazioneService) {
        this.segnalazioneService = segnalazioneService;
    }

    @GetMapping
    public List<SegnalazioneDto> elenca(@RequestParam(required = false) StatoSegnalazione stato,
                                         @RequestParam(required = false) Long autoreId,
                                         @RequestParam(defaultValue = "false") boolean mie) {
        return segnalazioneService.trova(stato, autoreId, mie);
    }

    @GetMapping("/vicine")
    public List<SegnalazioneDto> trovaVicine(@RequestParam double lat,
                                              @RequestParam double lng,
                                              @RequestParam double raggioMetri) {
        return segnalazioneService.trovaVicine(lat, lng, raggioMetri);
    }

    @GetMapping("/{id}")
    public SegnalazioneDto trovaPerId(@PathVariable Long id) {
        return segnalazioneService.trovaPerId(id);
    }

    @PostMapping
    public ResponseEntity<SegnalazioneDto> crea(@Valid @RequestBody SegnalazioneRequest request) {
        SegnalazioneDto creata = segnalazioneService.crea(request);
        return ResponseEntity.created(URI.create("/api/segnalazioni/" + creata.id())).body(creata);
    }

    @PatchMapping("/{id}/rimuovi")
    public SegnalazioneDto rimuovi(@PathVariable Long id, @Valid @RequestBody SegnalazioneTransizioneRequest request) {
        return segnalazioneService.rimuovi(id, request);
    }

    @PatchMapping("/{id}/riattiva")
    public SegnalazioneDto riattiva(@PathVariable Long id, @Valid @RequestBody SegnalazioneTransizioneRequest request) {
        return segnalazioneService.riattiva(id, request);
    }
}
