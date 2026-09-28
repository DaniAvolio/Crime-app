package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.CambioPasswordRequest;
import com.daniele.crime_app_backend.dto.UtenteAggiornamentoRequest;
import com.daniele.crime_app_backend.dto.UtenteDto;
import com.daniele.crime_app_backend.dto.UtenteRegistrazioneRequest;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.entity.enums.RuoloUtente;
import com.daniele.crime_app_backend.exception.ConflittoException;
import com.daniele.crime_app_backend.exception.RichiestaNonValidaException;
import com.daniele.crime_app_backend.exception.RisorsaNonTrovataException;
import com.daniele.crime_app_backend.mapper.UtenteMapper;
import com.daniele.crime_app_backend.repository.UtenteRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@Transactional(readOnly = true)
public class UtenteService {

    private final UtenteRepository utenteRepository;
    private final UtenteMapper utenteMapper;
    private final PasswordEncoder passwordEncoder;
    private final String emailAdminIniziale;

    public UtenteService(UtenteRepository utenteRepository, UtenteMapper utenteMapper, PasswordEncoder passwordEncoder,
                         @Value("${crimeapp.auth.admin-email:}") String emailAdminIniziale) {
        this.utenteRepository = utenteRepository;
        this.utenteMapper = utenteMapper;
        this.passwordEncoder = passwordEncoder;
        this.emailAdminIniziale = emailAdminIniziale.trim();
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
        promuoviSeAdminConfigurato(utente);
        return utenteMapper.toDto(utenteRepository.save(utente));
    }

    @Transactional
    public UtenteDto aggiorna(Long id, UtenteAggiornamentoRequest request) {
        Utente utente = recuperaOLancia(id);
        utente.setNome(request.nome());
        utente.setCognome(request.cognome());
        return utenteMapper.toDto(utente);
    }

    /** Cambio della propria password: va confermata quella attuale. */
    @Transactional
    public void cambiaPassword(Long id, CambioPasswordRequest request) {
        Utente utente = recuperaOLancia(id);
        if (!passwordEncoder.matches(request.passwordAttuale(), utente.getPasswordHash())) {
            throw new RichiestaNonValidaException("La password attuale non è corretta");
        }
        if (passwordEncoder.matches(request.nuovaPassword(), utente.getPasswordHash())) {
            throw new RichiestaNonValidaException("La nuova password deve essere diversa da quella attuale");
        }
        utente.setPasswordHash(passwordEncoder.encode(request.nuovaPassword()));
        log.info("Password cambiata dall'utente {}", id);
    }

    @Transactional
    public UtenteDto cambiaRuolo(Long id, RuoloUtente ruolo) {
        Utente utente = recuperaOLancia(id);
        if (utente.getRuolo() == ruolo) {
            return utenteMapper.toDto(utente);
        }
        if (ruolo != RuoloUtente.ADMIN) {
            verificaNonUltimoAdmin(utente);
        }
        log.info("Ruolo dell'utente {} cambiato da {} a {}", id, utente.getRuolo(), ruolo);
        utente.setRuolo(ruolo);
        return utenteMapper.toDto(utente);
    }

    @Transactional
    public void disattiva(Long id) {
        Utente utente = recuperaOLancia(id);
        verificaNonUltimoAdmin(utente);
        utente.setAttivo(false);
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
        Utente utente = recuperaOLancia(id);
        verificaNonUltimoAdmin(utente);
        utenteRepository.delete(utente);
    }

    /**
     * Bootstrap del primo amministratore: l'utente con email pari a
     * crimeapp.auth.admin-email diventa ADMIN, sia alla registrazione sia
     * all'avvio dell'applicazione (vedi AdminInizialeRunner). Senza email
     * configurata non ha effetto; gli admin successivi si gestiscono da API.
     */
    @Transactional
    public void promuoviSeAdminConfigurato(Utente utente) {
        if (emailAdminIniziale.isEmpty() || !emailAdminIniziale.equalsIgnoreCase(utente.getEmail())
                || utente.getRuolo() == RuoloUtente.ADMIN) {
            return;
        }
        utente.setRuolo(RuoloUtente.ADMIN);
        log.info("Utente {} promosso ad ADMIN perché corrisponde a crimeapp.auth.admin-email", utente.getEmail());
    }

    /** Applica promuoviSeAdminConfigurato all'utente registrato con l'email configurata, se esiste già. */
    @Transactional
    public void promuoviAdminConfigurato() {
        if (emailAdminIniziale.isEmpty()) {
            return;
        }
        utenteRepository.findByEmailIgnoreCase(emailAdminIniziale).ifPresentOrElse(
                this::promuoviSeAdminConfigurato,
                () -> log.info("Nessun utente con email {}: sarà promosso ad ADMIN quando si registrerà",
                        emailAdminIniziale));
    }

    /** Declassare, disattivare o eliminare l'ultimo admin attivo lascerebbe l'app senza nessuno che la gestisca. */
    private void verificaNonUltimoAdmin(Utente utente) {
        if (utente.getRuolo() == RuoloUtente.ADMIN && utente.isAttivo()
                && utenteRepository.countByRuoloAndAttivoTrue(RuoloUtente.ADMIN) <= 1) {
            throw new ConflittoException("Deve restare almeno un amministratore attivo");
        }
    }

    Utente recuperaOLancia(Long id) {
        return utenteRepository.findById(id)
                .orElseThrow(() -> new RisorsaNonTrovataException("Utente non trovato con id: " + id));
    }
}
