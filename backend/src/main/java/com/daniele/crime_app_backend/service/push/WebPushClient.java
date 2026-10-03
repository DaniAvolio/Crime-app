package com.daniele.crime_app_backend.service.push;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.GeneralSecurityException;
import java.security.interfaces.ECPrivateKey;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Invia una push cifrata a una sottoscrizione Web Push (endpoint + chiavi del browser), firmata
 * con le chiavi VAPID del server (RFC 8292). Nessuna libreria esterna: cifratura in
 * CifraturaWebPush, JWT con Nimbus (già usato per l'autenticazione).
 */
@Slf4j
@Component
public class WebPushClient {

    /** Esito dell'invio: SCADUTA = il browser ha revocato la sottoscrizione, va cancellata. */
    public enum Esito { INVIATA, SCADUTA, ERRORE }

    /** Ore di validità del JWT VAPID (massimo 24 per le specifiche). */
    private static final long ORE_VALIDITA_JWT = 12;
    /** Quanto il servizio push conserva il messaggio se il dispositivo è spento. */
    private static final Duration TTL = Duration.ofHours(12);

    private final String chiavePubblica;
    private final ECPrivateKey chiavePrivata;
    private final String soggetto;
    private final HttpClient http;
    /** Un JWT per servizio push (origine dell'endpoint), riusato finché non sta per scadere. */
    private final Map<String, JwtFirmato> jwtPerOrigine = new ConcurrentHashMap<>();

    private record JwtFirmato(String valore, Instant scadenza) {}

    public WebPushClient(@Value("${crimeapp.push.vapid.chiave-pubblica}") String chiavePubblica,
                         @Value("${crimeapp.push.vapid.chiave-privata}") String chiavePrivata,
                         @Value("${crimeapp.push.vapid.soggetto}") String soggetto) throws GeneralSecurityException {
        this.chiavePubblica = chiavePubblica.trim();
        this.chiavePrivata = ChiaviEc.privata(ChiaviEc.daBase64Url(chiavePrivata));
        this.soggetto = soggetto;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        // Errore di configurazione evidente all'avvio, non al primo invio.
        ChiaviEc.pubblica(ChiaviEc.daBase64Url(this.chiavePubblica));
    }

    /** Chiave pubblica VAPID (base64url) che il browser usa per sottoscriversi. */
    public String chiavePubblica() {
        return chiavePubblica;
    }

    /**
     * @param urgente "Urgency: high" (segnalazioni gravi): i dispositivi in risparmio energetico
     *                la consegnano subito invece di rimandarla.
     */
    public Esito invia(String endpoint, String p256dh, String auth, byte[] contenuto, boolean urgente) {
        try {
            byte[] corpo = CifraturaWebPush.cifra(contenuto, ChiaviEc.daBase64Url(p256dh), ChiaviEc.daBase64Url(auth));
            URI uri = URI.create(endpoint);
            HttpRequest richiesta = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Encoding", "aes128gcm")
                    .header("Content-Type", "application/octet-stream")
                    .header("TTL", String.valueOf(TTL.toSeconds()))
                    .header("Urgency", urgente ? "high" : "normal")
                    .header("Authorization", "vapid t=" + jwt(uri) + ", k=" + chiavePubblica)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(corpo))
                    .build();
            int stato = http.send(richiesta, HttpResponse.BodyHandlers.discarding()).statusCode();
            if (stato == 404 || stato == 410) {
                return Esito.SCADUTA;
            }
            if (stato >= 200 && stato < 300) {
                return Esito.INVIATA;
            }
            log.warn("Push rifiutata dal servizio {}: HTTP {}", uri.getHost(), stato);
            return Esito.ERRORE;
        } catch (IOException | GeneralSecurityException | JOSEException | IllegalArgumentException e) {
            log.warn("Invio push non riuscito: {}", e.getMessage());
            return Esito.ERRORE;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Esito.ERRORE;
        }
    }

    /** JWT VAPID: aud = origine del servizio push, scadenza entro 24 ore, sub = contatto. */
    String jwt(URI endpoint) throws JOSEException {
        String origine = endpoint.getScheme() + "://" + endpoint.getAuthority();
        Instant adesso = Instant.now();
        JwtFirmato esistente = jwtPerOrigine.get(origine);
        if (esistente != null && esistente.scadenza().isAfter(adesso.plus(Duration.ofHours(1)))) {
            return esistente.valore();
        }
        Instant scadenza = adesso.plus(Duration.ofHours(ORE_VALIDITA_JWT));
        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.ES256).type(JOSEObjectType.JWT).build(),
                new JWTClaimsSet.Builder().audience(origine).expirationTime(Date.from(scadenza)).subject(soggetto).build());
        jwt.sign(new ECDSASigner(chiavePrivata));
        String valore = jwt.serialize();
        jwtPerOrigine.put(origine, new JwtFirmato(valore, scadenza));
        return valore;
    }
}
