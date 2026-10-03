package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.PreferenzeNotificaDto;
import com.daniele.crime_app_backend.dto.PreferenzeNotificaRequest;
import com.daniele.crime_app_backend.entity.Categoria;
import com.daniele.crime_app_backend.entity.PreferenzeNotifica;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.exception.RichiestaNonValidaException;
import com.daniele.crime_app_backend.repository.CategoriaRepository;
import com.daniele.crime_app_backend.repository.PreferenzeNotificaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;

/** Preferenze delle notifiche dell'utente autenticato (vedi PreferenzeNotifica per i default). */
@Service
@Transactional(readOnly = true)
public class PreferenzeNotificaService {

    private final PreferenzeNotificaRepository preferenzeNotificaRepository;
    private final CategoriaRepository categoriaRepository;
    private final UtenteCorrenteService utenteCorrenteService;

    public PreferenzeNotificaService(PreferenzeNotificaRepository preferenzeNotificaRepository,
                                      CategoriaRepository categoriaRepository,
                                      UtenteCorrenteService utenteCorrenteService) {
        this.preferenzeNotificaRepository = preferenzeNotificaRepository;
        this.categoriaRepository = categoriaRepository;
        this.utenteCorrenteService = utenteCorrenteService;
    }

    /** Le preferenze di default valgono finché l'utente non le personalizza. */
    public PreferenzeNotificaDto trovaPerUtenteCorrente() {
        Long utenteId = utenteCorrenteService.idCorrente();
        return toDto(preferenzeNotificaRepository.findByUtenteId(utenteId)
                .orElseGet(() -> PreferenzeNotifica.builder().build()));
    }

    /** Upsert: crea le preferenze al primo salvataggio, poi le aggiorna. */
    @Transactional
    public PreferenzeNotificaDto aggiornaOCrea(PreferenzeNotificaRequest request) {
        if ((request.oreSilenzioDa() == null) != (request.oreSilenzioA() == null)) {
            throw new RichiestaNonValidaException("Indica sia l'inizio sia la fine delle ore di silenzio, o nessuna");
        }
        if (request.oreSilenzioDa() != null && request.oreSilenzioDa().equals(request.oreSilenzioA())) {
            throw new RichiestaNonValidaException("Inizio e fine delle ore di silenzio devono essere diversi");
        }
        List<Long> ids = request.categorieId().stream().filter(Objects::nonNull).distinct().toList();
        List<Categoria> categorie = categoriaRepository.findAllById(ids);
        if (categorie.size() != ids.size()) {
            throw new RichiestaNonValidaException("Una o più categorie non esistono");
        }

        Utente utente = utenteCorrenteService.utenteCorrente();
        PreferenzeNotifica preferenze = preferenzeNotificaRepository.findByUtenteId(utente.getId())
                .orElseGet(() -> PreferenzeNotifica.builder().utente(utente).build());
        preferenze.setNotificheAttive(request.notificheAttive());
        preferenze.setGravitaMinima(request.gravitaMinima());
        preferenze.setCategorie(new HashSet<>(categorie));
        preferenze.setOreSilenzioDa(request.oreSilenzioDa());
        preferenze.setOreSilenzioA(request.oreSilenzioA());
        preferenze.setGraviInSilenzio(request.graviInSilenzio());
        preferenze.setAggiornamentiMie(request.aggiornamentiMie());
        return toDto(preferenzeNotificaRepository.save(preferenze));
    }

    private static PreferenzeNotificaDto toDto(PreferenzeNotifica p) {
        return new PreferenzeNotificaDto(p.isNotificheAttive(), p.getGravitaMinima(),
                p.getCategorie().stream().map(Categoria::getId).sorted().toList(),
                p.getOreSilenzioDa(), p.getOreSilenzioA(), p.isGraviInSilenzio(), p.isAggiornamentiMie());
    }
}
