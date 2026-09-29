package com.daniele.crime_app_backend.controller;

import com.daniele.crime_app_backend.dto.CategoriaDto;
import com.daniele.crime_app_backend.dto.CategoriaRequest;
import com.daniele.crime_app_backend.dto.FiltriCategorie;
import com.daniele.crime_app_backend.dto.PaginaDto;
import com.daniele.crime_app_backend.service.CategoriaService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/categorie")
public class CategoriaController {

    private final CategoriaService categoriaService;

    public CategoriaController(CategoriaService categoriaService) {
        this.categoriaService = categoriaService;
    }

    @GetMapping
    public List<CategoriaDto> elenca(@RequestParam(name = "soloAttive", defaultValue = "false") boolean soloAttive) {
        return soloAttive ? categoriaService.trovaAttive() : categoriaService.trovaTutte();
    }

    /** Tabella di gestione (solo admin, vedi SecurityConfig): ordina=campo,asc|desc. */
    @GetMapping("/gestione")
    public PaginaDto<CategoriaDto> gestione(FiltriCategorie filtri,
                                            @RequestParam(defaultValue = "0") int pagina,
                                            @RequestParam(defaultValue = "25") int dimensione,
                                            @RequestParam(required = false) String ordina) {
        return categoriaService.trovaPerGestione(filtri, pagina, dimensione, ordina);
    }

    @GetMapping("/{id}")
    public CategoriaDto trovaPerId(@PathVariable Long id) {
        return categoriaService.trovaPerId(id);
    }

    @PostMapping
    public ResponseEntity<CategoriaDto> crea(@Valid @RequestBody CategoriaRequest request) {
        CategoriaDto creata = categoriaService.crea(request);
        return ResponseEntity.created(URI.create("/api/categorie/" + creata.id())).body(creata);
    }

    @PutMapping("/{id}")
    public CategoriaDto aggiorna(@PathVariable Long id, @Valid @RequestBody CategoriaRequest request) {
        return categoriaService.aggiorna(id, request);
    }

    /** Disattivazione logica (attiva=false): la categoria resta nel DB e può essere riattivata. */
    @PatchMapping("/{id}/disattiva")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void disattiva(@PathVariable Long id) {
        categoriaService.disattiva(id);
    }

    /** Riporta attiva=true una categoria precedentemente disattivata. */
    @PatchMapping("/{id}/riattiva")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void riattiva(@PathVariable Long id) {
        categoriaService.riattiva(id);
    }

    /**
     * Cancellazione fisica dal database. Fallisce con 409 se la categoria è
     * referenziata da segnalazioni esistenti (vedi GlobalExceptionHandler).
     */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void elimina(@PathVariable Long id) {
        categoriaService.eliminaDefinitivamente(id);
    }
}
