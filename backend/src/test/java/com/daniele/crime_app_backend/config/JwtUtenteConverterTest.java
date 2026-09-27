package com.daniele.crime_app_backend.config;

import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.entity.enums.RuoloUtente;
import com.daniele.crime_app_backend.repository.UtenteRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JwtUtenteConverterTest {

    @Mock
    private UtenteRepository utenteRepository;

    @Test
    void ilRuoloVieneDalDbNonDalToken() {
        when(utenteRepository.findById(7L)).thenReturn(Optional.of(utente(RuoloUtente.UTENTE, true)));

        AbstractAuthenticationToken autenticazione =
                new JwtUtenteConverter(utenteRepository).convert(token("7", "ADMIN"));

        assertThat(autenticazione.getAuthorities()).extracting(GrantedAuthority::getAuthority)
                .containsExactly("ROLE_UTENTE");
    }

    @Test
    void utenteDisattivatoOInesistenteNonSiAutentica() {
        when(utenteRepository.findById(7L)).thenReturn(Optional.of(utente(RuoloUtente.ADMIN, false)));
        when(utenteRepository.findById(8L)).thenReturn(Optional.empty());
        JwtUtenteConverter converter = new JwtUtenteConverter(utenteRepository);

        assertThatThrownBy(() -> converter.convert(token("7", "ADMIN"))).isInstanceOf(BadCredentialsException.class);
        assertThatThrownBy(() -> converter.convert(token("8", "UTENTE"))).isInstanceOf(BadCredentialsException.class);
    }

    private static Jwt token(String subject, String ruolo) {
        return Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject(subject)
                .claim("ruolo", ruolo)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();
    }

    private static Utente utente(RuoloUtente ruolo, boolean attivo) {
        return Utente.builder().id(7L).nome("Mario").cognome("Rossi").email("m@example.com")
                .passwordHash("hash").ruolo(ruolo).attivo(attivo).build();
    }
}
