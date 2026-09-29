package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.CategoriaDto;
import com.daniele.crime_app_backend.dto.CategoriaRequest;
import com.daniele.crime_app_backend.dto.FiltriCategorie;
import com.daniele.crime_app_backend.dto.PaginaDto;
import com.daniele.crime_app_backend.entity.Categoria;
import com.daniele.crime_app_backend.exception.ConflittoException;
import com.daniele.crime_app_backend.exception.RisorsaNonTrovataException;
import com.daniele.crime_app_backend.mapper.CategoriaMapper;
import com.daniele.crime_app_backend.repository.CategoriaRepository;
import com.daniele.crime_app_backend.repository.SpecificheGestione;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@Transactional(readOnly = true)
public class CategoriaService {

    private final CategoriaRepository categoriaRepository;
    private final CategoriaMapper categoriaMapper;

    public CategoriaService(CategoriaRepository categoriaRepository, CategoriaMapper categoriaMapper) {
        this.categoriaRepository = categoriaRepository;
        this.categoriaMapper = categoriaMapper;
    }

    /** Prima le più gravi (3 -> 1), poi per nome: ordine usato da gestione, form e mappa. */
    private static final Sort ORDINE_CATEGORIE = Sort.by(Sort.Order.desc("gravita"), Sort.Order.asc("nome"));

    public List<CategoriaDto> trovaTutte() {
        return categoriaRepository.findAll(ORDINE_CATEGORIE).stream()
                .map(categoriaMapper::toDto)
                .toList();
    }

    /** Colonne ordinabili della tabella in gestione: nome esposto al client -> proprietà JPA. */
    private static final Map<String, String> ORDINABILI_GESTIONE = Map.of(
            "nome", "nome",
            "gravita", "gravita",
            "durataValiditaOre", "durataValiditaOre",
            "attiva", "attiva");

    /** Tabella di gestione: filtri, ordinamento (default gravità 3 -> 1, poi nome) e paginazione. */
    public PaginaDto<CategoriaDto> trovaPerGestione(FiltriCategorie filtri, int pagina, int dimensione,
                                                    String ordina) {
        Pageable richiesta = Paginazione.crea(pagina, dimensione, ordina, ORDINABILI_GESTIONE, ORDINE_CATEGORIE);
        return PaginaDto.da(categoriaRepository.findAll(SpecificheGestione.categorie(filtri), richiesta),
                categoriaMapper::toDto);
    }

    public List<CategoriaDto> trovaAttive() {
        return categoriaRepository.findByAttivaTrue(ORDINE_CATEGORIE).stream()
                .map(categoriaMapper::toDto)
                .toList();
    }

    public CategoriaDto trovaPerId(Long id) {
        return categoriaMapper.toDto(recuperaOLancia(id));
    }

    @Transactional
    public CategoriaDto crea(CategoriaRequest request) {
        verificaNomiLiberi(request, null);
        Categoria categoria = categoriaRepository.save(categoriaMapper.toEntity(request));
        log.info("Categoria creata: id={}, nome={}", categoria.getId(), categoria.getNome());
        return categoriaMapper.toDto(categoria);
    }

    @Transactional
    public CategoriaDto aggiorna(Long id, CategoriaRequest request) {
        Categoria categoria = recuperaOLancia(id);
        verificaNomiLiberi(request, id);
        categoriaMapper.aggiornaEntity(categoria, request);
        log.info("Categoria aggiornata: id={}", id);
        return categoriaMapper.toDto(categoria);
    }

    @Transactional
    public void disattiva(Long id) {
        Categoria categoria = recuperaOLancia(id);
        categoria.setAttiva(false);
        log.info("Categoria disattivata: id={}", id);
    }

    @Transactional
    public void riattiva(Long id) {
        Categoria categoria = recuperaOLancia(id);
        categoria.setAttiva(true);
        log.info("Categoria riattivata: id={}", id);
    }

    /**
     * Cancellazione fisica dal database. Se la categoria è referenziata da
     * segnalazioni esistenti, il vincolo di chiave esterna a livello DB fa
     * fallire l'operazione: DataIntegrityViolationException viene intercettata
     * a livello globale (GlobalExceptionHandler) e tradotta in un 409.
     */
    @Transactional
    public void eliminaDefinitivamente(Long id) {
        Categoria categoria = recuperaOLancia(id);
        categoriaRepository.delete(categoria);
        log.info("Eliminazione definitiva categoria richiesta: id={}", id);
    }

    /** Il nome deve essere unico sia in italiano sia in ciascuna lingua tradotta. */
    private void verificaNomiLiberi(CategoriaRequest request, Long idEscluso) {
        categoriaRepository.findByNome(request.nome())
                .filter(esistente -> !esistente.getId().equals(idEscluso))
                .ifPresent(esistente -> {
                    throw new ConflittoException("Esiste già una categoria con nome: " + request.nome());
                });
        categoriaMapper.traduzioniEntity(request.traduzioni()).forEach((lingua, traduzione) -> {
            if (categoriaRepository.esisteTraduzione(lingua, traduzione.getNome(), idEscluso)) {
                throw new ConflittoException("Esiste già una categoria con nome " + lingua.toUpperCase()
                        + ": " + traduzione.getNome());
            }
        });
    }

    Categoria recuperaOLancia(Long id) {
        return categoriaRepository.findById(id)
                .orElseThrow(() -> new RisorsaNonTrovataException("Categoria non trovata con id: " + id));
    }
}
