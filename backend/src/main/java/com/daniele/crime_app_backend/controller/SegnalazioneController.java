package com.daniele.crime_app_backend.controller;

import com.daniele.crime_app_backend.dto.ConteggiMieSegnalazioniDto;
import com.daniele.crime_app_backend.dto.ConteggioCategoriaDto;
import com.daniele.crime_app_backend.dto.FiltriSegnalazioni;
import com.daniele.crime_app_backend.dto.GruppoSegnalazioniMie;
import com.daniele.crime_app_backend.dto.PaginaDto;
import com.daniele.crime_app_backend.dto.SegnalazioneDto;
import com.daniele.crime_app_backend.dto.SegnalazioneRequest;
import com.daniele.crime_app_backend.dto.SegnalazioneTransizioneRequest;
import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;
import com.daniele.crime_app_backend.service.SegnalazioneService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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

    /** Tabella di gestione (solo admin, vedi SecurityConfig): ordina=campo,asc|desc. */
    @GetMapping("/gestione")
    public PaginaDto<SegnalazioneDto> gestione(FiltriSegnalazioni filtri,
                                               @RequestParam(defaultValue = "0") int pagina,
                                               @RequestParam(defaultValue = "25") int dimensione,
                                               @RequestParam(required = false) String ordina) {
        return segnalazioneService.trovaPerGestione(filtri, pagina, dimensione, ordina);
    }

    /** Profilo: le mie segnalazioni di una scheda, a pagine (richiede login, vedi SecurityConfig). */
    @GetMapping("/mie")
    public PaginaDto<SegnalazioneDto> mie(@RequestParam GruppoSegnalazioniMie gruppo,
                                          @RequestParam(defaultValue = "0") int pagina,
                                          @RequestParam(defaultValue = "20") int dimensione) {
        return segnalazioneService.trovaMie(gruppo, pagina, dimensione);
    }

    @GetMapping("/mie/conteggi")
    public ConteggiMieSegnalazioniDto conteggiMie() {
        return segnalazioneService.conteggiMie();
    }

    @GetMapping("/vicine")
    public List<SegnalazioneDto> trovaVicine(@RequestParam double lat,
                                              @RequestParam double lng,
                                              @RequestParam double raggioMetri) {
        return segnalazioneService.trovaVicine(lat, lng, raggioMetri);
    }

    /** Vista lista (pubblica): pagine dalla più vicina, filtri opzionali per gravità e categoria. */
    @GetMapping("/vicine/lista")
    public PaginaDto<SegnalazioneDto> vicinePerDistanza(@RequestParam double lat,
                                                        @RequestParam double lng,
                                                        @RequestParam double raggioMetri,
                                                        @RequestParam(required = false) Integer gravita,
                                                        @RequestParam(required = false) Long categoriaId,
                                                        @RequestParam(defaultValue = "0") int pagina,
                                                        @RequestParam(defaultValue = "20") int dimensione) {
        return segnalazioneService.trovaVicinePerDistanza(lat, lng, raggioMetri, gravita, categoriaId,
                pagina, dimensione);
    }

    /** Vista lista (pubblica): segnalazioni nel raggio per categoria, per i chip dei filtri. */
    @GetMapping("/vicine/conteggi")
    public List<ConteggioCategoriaDto> conteggiVicine(@RequestParam double lat,
                                                      @RequestParam double lng,
                                                      @RequestParam double raggioMetri,
                                                      @RequestParam(required = false) Integer gravita) {
        return segnalazioneService.conteggiVicinePerCategoria(lat, lng, raggioMetri, gravita);
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

    /** Cancellazione fisica, solo ADMIN (vedi SecurityConfig). */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void elimina(@PathVariable Long id) {
        segnalazioneService.eliminaDefinitivamente(id);
    }
}
