package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.config.SecurityConfig;
import com.daniele.crime_app_backend.dto.AuthResponse;
import com.daniele.crime_app_backend.dto.LoginRequest;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.entity.enums.RuoloUtente;
import com.daniele.crime_app_backend.exception.AccessoNegatoException;
import com.daniele.crime_app_backend.exception.CredenzialiNonValideException;
import com.daniele.crime_app_backend.mapper.UtenteMapper;
import com.daniele.crime_app_backend.repository.UtenteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final String EMAIL = "mario.rossi@example.com";
    private static final String PASSWORD = "password-sicura";

    @Mock
    private UtenteRepository utenteRepository;
    @Mock
    private UtenteService utenteService;
    @Mock
    private UtenteCorrenteService utenteCorrenteService;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final SecurityConfig securityConfig = new SecurityConfig("segreto-di-test-lungo-almeno-32-byte!!");
    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(utenteRepository, utenteService, utenteCorrenteService, new UtenteMapper(),
                passwordEncoder, securityConfig.jwtEncoder(), 60);
    }

    @Test
    void loginValidoRestituisceTokenConIdERuolo() {
        when(utenteRepository.findByEmail(EMAIL)).thenReturn(Optional.of(utente(true, RuoloUtente.ADMIN)));

        AuthResponse risposta = authService.login(new LoginRequest(EMAIL, PASSWORD));

        Jwt jwt = securityConfig.jwtDecoder().decode(risposta.token());
        assertThat(jwt.getSubject()).isEqualTo("7");
        assertThat(jwt.getClaimAsString("ruolo")).isEqualTo("ADMIN");
        assertThat(jwt.getExpiresAt()).isEqualTo(risposta.scadenza());
        assertThat(risposta.utente().id()).isEqualTo(7L);
    }

    @Test
    void passwordErrataRestituisceCredenzialiNonValide() {
        when(utenteRepository.findByEmail(EMAIL)).thenReturn(Optional.of(utente(true, RuoloUtente.UTENTE)));

        assertThatThrownBy(() -> authService.login(new LoginRequest(EMAIL, "password-sbagliata")))
                .isInstanceOf(CredenzialiNonValideException.class);
    }

    @Test
    void emailInesistenteRestituisceLoStessoErroreDellaPasswordErrata() {
        when(utenteRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest(EMAIL, PASSWORD)))
                .isInstanceOf(CredenzialiNonValideException.class)
                .hasMessage("Email o password non validi");
    }

    @Test
    void utenteDisattivatoNonPuoAccedere() {
        when(utenteRepository.findByEmail(EMAIL)).thenReturn(Optional.of(utente(false, RuoloUtente.UTENTE)));

        assertThatThrownBy(() -> authService.login(new LoginRequest(EMAIL, PASSWORD)))
                .isInstanceOf(AccessoNegatoException.class);
    }

    private Utente utente(boolean attivo, RuoloUtente ruolo) {
        return Utente.builder()
                .id(7L)
                .nome("Mario")
                .cognome("Rossi")
                .email(EMAIL)
                .passwordHash(passwordEncoder.encode(PASSWORD))
                .attivo(attivo)
                .ruolo(ruolo)
                .build();
    }
}
