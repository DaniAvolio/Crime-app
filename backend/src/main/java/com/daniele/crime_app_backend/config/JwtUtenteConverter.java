package com.daniele.crime_app_backend.config;

import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.repository.UtenteRepository;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * Trasforma un JWT valido nell'autenticazione della richiesta rileggendo ruolo
 * e stato dell'Utente dal DB (una query per chiave primaria): così un admin
 * declassato o un account disattivato perdono i permessi subito, senza
 * aspettare la scadenza del token. Il claim "ruolo" nel token resta solo
 * un'informazione per il client.
 */
@Component
public class JwtUtenteConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final UtenteRepository utenteRepository;

    public JwtUtenteConverter(UtenteRepository utenteRepository) {
        this.utenteRepository = utenteRepository;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        Utente utente = idUtente(jwt)
                .flatMap(utenteRepository::findById)
                .filter(Utente::isAttivo)
                .orElseThrow(() -> new BadCredentialsException("Utente del token inesistente o disattivato"));
        return new JwtAuthenticationToken(jwt,
                List.of(new SimpleGrantedAuthority("ROLE_" + utente.getRuolo().name())), jwt.getSubject());
    }

    private static Optional<Long> idUtente(Jwt jwt) {
        try {
            return Optional.of(Long.valueOf(jwt.getSubject()));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }
}
