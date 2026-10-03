package com.daniele.crime_app_backend.config;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Autenticazione stateless via JWT (HS256) firmati dal backend stesso (vedi
 * AuthService): nessuna sessione server, il client invia
 * "Authorization: Bearer &lt;token&gt;". Il subject del token è l'id dell'Utente;
 * ruolo (authority ROLE_UTENTE / ROLE_ADMIN) e stato attivo vengono riletti dal
 * DB a ogni richiesta da JwtUtenteConverter.
 *
 * Regole di accesso: la consultazione (mappa, segnalazioni, categorie) è
 * pubblica; ogni scrittura richiede login; gestione utenti, categorie e
 * moderazione sono riservate agli ADMIN. I controlli più fini (es. "solo
 * l'autore o un admin può rimuovere") restano nei service.
 */
@Configuration
public class SecurityConfig {

    private final SecretKey chiaveJwt;

    public SecurityConfig(@Value("${crimeapp.auth.jwt-secret}") String jwtSecret) {
        byte[] byteChiave = jwtSecret.getBytes(StandardCharsets.UTF_8);
        if (byteChiave.length < 32) {
            throw new IllegalStateException("crimeapp.auth.jwt-secret deve essere lungo almeno 32 byte (HS256)");
        }
        this.chiaveJwt = new SecretKeySpec(byteChiave, "HmacSHA256");
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, ErroriSicurezzaHandler erroriSicurezza,
                                           JwtUtenteConverter jwtUtenteConverter) throws Exception {
        http
                // CSRF non serve: nessun cookie di sessione, il token viaggia in un header esplicito.
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/registrazione").permitAll()
                        // Prima delle regole GET pubbliche: "/api/segnalazioni/*" non deve aprirle.
                        .requestMatchers(HttpMethod.GET,
                                "/api/segnalazioni/gestione", "/api/segnalazioni/gestione/da-rivedere",
                                "/api/categorie/gestione",
                                "/api/segnalazioni/*/abusi", "/api/segnalazioni/*/eventi-moderazione").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/segnalazioni/mie", "/api/segnalazioni/mie/conteggi")
                        .authenticated()
                        .requestMatchers(HttpMethod.GET,
                                "/api/segnalazioni", "/api/segnalazioni/*", "/api/segnalazioni/vicine/*",
                                "/api/categorie/**").permitAll()
                        .requestMatchers(HttpMethod.PATCH, "/api/segnalazioni/*/riattiva",
                                "/api/segnalazioni/*/abusi/esito").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/segnalazioni/*").hasRole("ADMIN")
                        .requestMatchers("/api/categorie/**").hasRole("ADMIN")
                        .requestMatchers("/api/utenti/me/**").authenticated()
                        .requestMatchers("/api/utenti/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtUtenteConverter))
                        .authenticationEntryPoint(erroriSicurezza)
                        .accessDeniedHandler(erroriSicurezza))
                .exceptionHandling(eccezioni -> eccezioni
                        .authenticationEntryPoint(erroriSicurezza)
                        .accessDeniedHandler(erroriSicurezza));
        return http.build();
    }

    @Bean
    public JwtEncoder jwtEncoder() {
        return new NimbusJwtEncoder(new ImmutableSecret<>(chiaveJwt));
    }

    @Bean
    public JwtDecoder jwtDecoder() {
        return NimbusJwtDecoder.withSecretKey(chiaveJwt).macAlgorithm(MacAlgorithm.HS256).build();
    }

    /**
     * Il frontend Angular gira su una porta diversa (4200) rispetto al backend
     * (8080): senza CORS il browser blocca le chiamate per via della same-origin
     * policy. In produzione andrà ristretto al dominio reale del frontend.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("http://localhost:4200"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
