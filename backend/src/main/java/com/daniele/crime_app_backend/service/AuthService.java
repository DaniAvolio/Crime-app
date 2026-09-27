package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.AuthResponse;
import com.daniele.crime_app_backend.dto.LoginRequest;
import com.daniele.crime_app_backend.dto.UtenteDto;
import com.daniele.crime_app_backend.dto.UtenteRegistrazioneRequest;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.exception.AccessoNegatoException;
import com.daniele.crime_app_backend.exception.CredenzialiNonValideException;
import com.daniele.crime_app_backend.mapper.UtenteMapper;
import com.daniele.crime_app_backend.repository.UtenteRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Slf4j
@Service
@Transactional(readOnly = true)
public class AuthService {

    static final String ISSUER = "crime-app";

    private final UtenteRepository utenteRepository;
    private final UtenteService utenteService;
    private final UtenteCorrenteService utenteCorrenteService;
    private final UtenteMapper utenteMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;
    private final long durataTokenMinuti;

    public AuthService(UtenteRepository utenteRepository,
                       UtenteService utenteService,
                       UtenteCorrenteService utenteCorrenteService,
                       UtenteMapper utenteMapper,
                       PasswordEncoder passwordEncoder,
                       JwtEncoder jwtEncoder,
                       @Value("${crimeapp.auth.jwt-durata-minuti:1440}") long durataTokenMinuti) {
        this.utenteRepository = utenteRepository;
        this.utenteService = utenteService;
        this.utenteCorrenteService = utenteCorrenteService;
        this.utenteMapper = utenteMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtEncoder = jwtEncoder;
        this.durataTokenMinuti = durataTokenMinuti;
    }

    /**
     * Email inesistente e password errata producono lo stesso messaggio, per
     * non rivelare quali email sono registrate.
     */
    public AuthResponse login(LoginRequest request) {
        Utente utente = utenteRepository.findByEmail(request.email())
                .filter(u -> passwordEncoder.matches(request.password(), u.getPasswordHash()))
                .orElseThrow(() -> new CredenzialiNonValideException("Email o password non validi"));
        if (!utente.isAttivo()) {
            throw new AccessoNegatoException("Account disattivato");
        }
        log.info("Login effettuato dall'utente {}", utente.getId());
        return rispostaPer(utente);
    }

    /** Registrazione pubblica: crea sempre un utente con ruolo UTENTE e lo autentica subito. */
    @Transactional
    public AuthResponse registra(UtenteRegistrazioneRequest request) {
        UtenteDto creato = utenteService.registra(request);
        log.info("Nuovo utente registrato: {}", creato.id());
        return rispostaPer(utenteService.recuperaOLancia(creato.id()));
    }

    public UtenteDto utenteCorrente() {
        return utenteMapper.toDto(utenteCorrenteService.utenteCorrente());
    }

    private AuthResponse rispostaPer(Utente utente) {
        // Il JWT memorizza le date in secondi: si tronca per restituire la stessa scadenza del token.
        Instant adesso = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        Instant scadenza = adesso.plus(durataTokenMinuti, ChronoUnit.MINUTES);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(ISSUER)
                .subject(utente.getId().toString())
                .issuedAt(adesso)
                .expiresAt(scadenza)
                .claim("email", utente.getEmail())
                .claim("ruolo", utente.getRuolo().name())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new AuthResponse(token, scadenza, utenteMapper.toDto(utente));
    }
}
