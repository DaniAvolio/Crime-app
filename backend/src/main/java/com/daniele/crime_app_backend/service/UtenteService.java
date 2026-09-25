package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.UtenteAggiornamentoRequest;
import com.daniele.crime_app_backend.dto.UtenteDto;
import com.daniele.crime_app_backend.dto.UtenteRegistrazioneRequest;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.exception.ConflittoException;
import com.daniele.crime_app_backend.exception.RisorsaNonTrovataException;
import com.daniele.crime_app_backend.mapper.UtenteMapper;
import com.daniele.crime_app_backend.repository.UtenteRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class UtenteService {

    private final UtenteRepository utenteRepository;
    private final UtenteMapper utenteMapper;
    private final PasswordEncoder passwordEncoder;

    public UtenteService(UtenteRepository utenteRepository, UtenteMapper utenteMapper, PasswordEncoder passwordEncoder) {
        this.utenteRepository = utenteRepository;
        this.utenteMapper = utenteMapper;
        this.passwordEncoder = passwordEncoder;
    }

    public List<UtenteDto> trovaTutti() {
        return utenteRepository.findAll().stream()
                .map(utenteMapper::toDto)
                .toList();
    }

    public UtenteDto trovaPerId(Long id) {
        return utenteMapper.toDto(recuperaOLancia(id));
    }

    @Transactional
    public UtenteDto registra(UtenteRegistrazioneRequest request) {
        if (utenteRepository.existsByEmail(request.email())) {
            throw new ConflittoException("Esiste già un utente con email: " + request.email());
        }
        Utente utente = Utente.builder()
                .nome(request.nome())
                .cognome(request.cognome())
                .email(request.email())
                .passwordHash(passwordEncoder.encode(request.password()))
                .build();
        return utenteMapper.toDto(utenteRepository.save(utente));
    }

    @Transactional
    public UtenteDto aggiorna(Long id, UtenteAggiornamentoRequest request) {
        Utente utente = recuperaOLancia(id);
        utente.setNome(request.nome());
        utente.setCognome(request.cognome());
        return utenteMapper.toDto(utente);
    }

    @Transactional
    public void disattiva(Long id) {
        recuperaOLancia(id).setAttivo(false);
    }

    @Transactional
    public void riattiva(Long id) {
        recuperaOLancia(id).setAttivo(true);
    }

    /**
     * Cancellazione fisica dal database. L'entità Utente ha cascade ALL su
     * segnalazioni, device token e preferenze notifica: eliminare un utente
     * elimina anche tutte le sue segnalazioni (e a cascata abusi/eventi
     * moderazione collegati). Preferire disattiva() per la sospensione di un
     * account.
     */
    @Transactional
    public void eliminaDefinitivamente(Long id) {
        utenteRepository.delete(recuperaOLancia(id));
    }

    Utente recuperaOLancia(Long id) {
        return utenteRepository.findById(id)
                .orElseThrow(() -> new RisorsaNonTrovataException("Utente non trovato con id: " + id));
    }
}
