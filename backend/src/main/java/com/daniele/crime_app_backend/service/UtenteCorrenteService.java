package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.entity.enums.RuoloUtente;
import com.daniele.crime_app_backend.exception.AccessoNegatoException;
import com.daniele.crime_app_backend.exception.CredenzialiNonValideException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Identità di chi sta facendo la richiesta, ricavata dal JWT validato da
 * Spring Security (vedi SecurityConfig). Sostituisce gli id utente che prima
 * arrivavano dal client nei body/path delle richieste.
 */
@Service
@Transactional(readOnly = true)
public class UtenteCorrenteService {

    private final UtenteService utenteService;

    public UtenteCorrenteService(UtenteService utenteService) {
        this.utenteService = utenteService;
    }

    /** Vuoto per le richieste anonime (endpoint pubblici di sola lettura). */
    public Optional<Long> idCorrenteOpzionale() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken jwt) {
            return Optional.of(Long.valueOf(jwt.getToken().getSubject()));
        }
        return Optional.empty();
    }

    public Long idCorrente() {
        return idCorrenteOpzionale()
                .orElseThrow(() -> new CredenzialiNonValideException("Autenticazione richiesta"));
    }

    /**
     * Carica l'Utente dal DB: il token resta valido fino alla scadenza anche se
     * l'account viene disattivato nel frattempo, quindi lo stato va ricontrollato
     * a ogni operazione che agisce per conto dell'utente.
     */
    public Utente utenteCorrente() {
        Utente utente = utenteService.recuperaOLancia(idCorrente());
        if (!utente.isAttivo()) {
            throw new AccessoNegatoException("Account disattivato");
        }
        return utente;
    }

    /** Ruolo dichiarato nel token, senza accesso al DB: adatto a decisioni di sola visualizzazione. */
    public boolean isAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_" + RuoloUtente.ADMIN.name()));
    }
}
