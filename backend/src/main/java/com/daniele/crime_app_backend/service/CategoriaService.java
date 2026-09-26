package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.CategoriaDto;
import com.daniele.crime_app_backend.dto.CategoriaRequest;
import com.daniele.crime_app_backend.entity.Categoria;
import com.daniele.crime_app_backend.exception.ConflittoException;
import com.daniele.crime_app_backend.exception.RisorsaNonTrovataException;
import com.daniele.crime_app_backend.mapper.CategoriaMapper;
import com.daniele.crime_app_backend.repository.CategoriaRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

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

    public List<CategoriaDto> trovaTutte() {
        return categoriaRepository.findAll().stream()
                .map(categoriaMapper::toDto)
                .toList();
    }

    public List<CategoriaDto> trovaAttive() {
        return categoriaRepository.findByAttivaTrue().stream()
                .map(categoriaMapper::toDto)
                .toList();
    }

    public CategoriaDto trovaPerId(Long id) {
        return categoriaMapper.toDto(recuperaOLancia(id));
    }

    @Transactional
    public CategoriaDto crea(CategoriaRequest request) {
        verificaNomeLibero(request.nome(), null);
        Categoria categoria = categoriaRepository.save(categoriaMapper.toEntity(request));
        log.info("Categoria creata: id={}, nome={}", categoria.getId(), categoria.getNome());
        return categoriaMapper.toDto(categoria);
    }

    @Transactional
    public CategoriaDto aggiorna(Long id, CategoriaRequest request) {
        Categoria categoria = recuperaOLancia(id);
        verificaNomeLibero(request.nome(), id);
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

    private void verificaNomeLibero(String nome, Long idEscluso) {
        categoriaRepository.findByNome(nome)
                .filter(esistente -> !esistente.getId().equals(idEscluso))
                .ifPresent(esistente -> {
                    throw new ConflittoException("Esiste già una categoria con nome: " + nome);
                });
    }

    Categoria recuperaOLancia(Long id) {
        return categoriaRepository.findById(id)
                .orElseThrow(() -> new RisorsaNonTrovataException("Categoria non trovata con id: " + id));
    }
}
