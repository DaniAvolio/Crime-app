package com.daniele.crime_app_backend.controller;

import com.daniele.crime_app_backend.dto.CambioPasswordRequest;
import com.daniele.crime_app_backend.dto.FiltriUtenti;
import com.daniele.crime_app_backend.dto.PaginaDto;
import com.daniele.crime_app_backend.dto.UtenteAggiornamentoRequest;
import com.daniele.crime_app_backend.dto.UtenteDto;
import com.daniele.crime_app_backend.dto.UtenteRegistrazioneRequest;
import com.daniele.crime_app_backend.dto.UtenteRuoloRequest;
import com.daniele.crime_app_backend.service.UtenteCorrenteService;
import com.daniele.crime_app_backend.service.UtenteService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/utenti")
public class UtenteController {

    private final UtenteService utenteService;
    private final UtenteCorrenteService utenteCorrenteService;

    public UtenteController(UtenteService utenteService, UtenteCorrenteService utenteCorrenteService) {
        this.utenteService = utenteService;
        this.utenteCorrenteService = utenteCorrenteService;
    }

    // Profilo: l'utente agisce su sé stesso, ricavato dal token (mai un id dal client).
    // Coperto da "/api/utenti/me/**" -> authenticated in SecurityConfig.

    @PutMapping("/me")
    public UtenteDto aggiornaProfilo(@Valid @RequestBody UtenteAggiornamentoRequest request) {
        return utenteService.aggiorna(utenteCorrenteService.utenteCorrente().getId(), request);
    }

    @PatchMapping("/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cambiaPassword(@Valid @RequestBody CambioPasswordRequest request) {
        utenteService.cambiaPassword(utenteCorrenteService.utenteCorrente().getId(), request);
    }

    @GetMapping
    public List<UtenteDto> elenca() {
        return utenteService.trovaTutti();
    }

    /** Tabella di gestione: ordina=campo,asc|desc. */
    @GetMapping("/gestione")
    public PaginaDto<UtenteDto> gestione(FiltriUtenti filtri,
                                         @RequestParam(defaultValue = "0") int pagina,
                                         @RequestParam(defaultValue = "25") int dimensione,
                                         @RequestParam(required = false) String ordina) {
        return utenteService.trovaPerGestione(filtri, pagina, dimensione, ordina);
    }

    @GetMapping("/{id}")
    public UtenteDto trovaPerId(@PathVariable Long id) {
        return utenteService.trovaPerId(id);
    }

    @PostMapping
    public ResponseEntity<UtenteDto> registra(@Valid @RequestBody UtenteRegistrazioneRequest request) {
        UtenteDto creato = utenteService.registra(request);
        return ResponseEntity.created(URI.create("/api/utenti/" + creato.id())).body(creato);
    }

    @PutMapping("/{id}")
    public UtenteDto aggiorna(@PathVariable Long id, @Valid @RequestBody UtenteAggiornamentoRequest request) {
        return utenteService.aggiorna(id, request);
    }

    @PatchMapping("/{id}/ruolo")
    public UtenteDto cambiaRuolo(@PathVariable Long id, @Valid @RequestBody UtenteRuoloRequest request) {
        return utenteService.cambiaRuolo(id, request.ruolo());
    }

    @PatchMapping("/{id}/disattiva")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void disattiva(@PathVariable Long id) {
        utenteService.disattiva(id);
    }

    @PatchMapping("/{id}/riattiva")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void riattiva(@PathVariable Long id) {
        utenteService.riattiva(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void elimina(@PathVariable Long id) {
        utenteService.eliminaDefinitivamente(id);
    }
}
