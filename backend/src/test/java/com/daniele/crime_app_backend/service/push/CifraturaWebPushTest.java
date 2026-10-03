package com.daniele.crime_app_backend.service.push;

import com.nimbusds.jose.crypto.ECDSAVerifier;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.Test;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

public class CifraturaWebPushTest {

    private static final String TESTO = "When I grow up, I want to be a watermelon";
    // Vettore d'esempio di RFC 8291, sezione 5.
    private static final String AS_PRIVATA = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
    private static final String AS_PUBBLICA =
            "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
    private static final String UA_PRIVATA = "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94";
    private static final String UA_PUBBLICA =
            "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
    private static final String AUTH = "BTBZMqHH6r4Tts7J_aSIgg";
    private static final String SALE = "DGv6ra1nlYgDCS1FRnbzlw";
    private static final String ATTESO = "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6"
            + "e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";

    @Test
    void riproduceIlVettoreDiProvaDellRfc8291() throws Exception {
        KeyPair server = new KeyPair(ChiaviEc.pubblica(ChiaviEc.daBase64Url(AS_PUBBLICA)),
                ChiaviEc.privata(ChiaviEc.daBase64Url(AS_PRIVATA)));

        byte[] corpo = CifraturaWebPush.cifra(TESTO.getBytes(StandardCharsets.UTF_8),
                ChiaviEc.daBase64Url(UA_PUBBLICA), ChiaviEc.daBase64Url(AUTH), server, ChiaviEc.daBase64Url(SALE));

        assertThat(ChiaviEc.inBase64Url(corpo)).isEqualTo(ATTESO);
    }

    @Test
    void ilBrowserRiesceADecifrareUnaPushCasuale() throws Exception {
        KeyPair browser = ChiaviEc.nuovaCoppia();
        byte[] auth = new byte[16];
        new java.security.SecureRandom().nextBytes(auth);
        byte[] pubblicaBrowser = ChiaviEc.puntoNonCompresso((ECPublicKey) browser.getPublic());

        byte[] corpo = CifraturaWebPush.cifra("{\"ciao\":\"è\"}".getBytes(StandardCharsets.UTF_8), pubblicaBrowser, auth);

        assertThat(new String(decifra(corpo, (ECPrivateKey) browser.getPrivate(), pubblicaBrowser, auth),
                StandardCharsets.UTF_8)).isEqualTo("{\"ciao\":\"è\"}");
    }

    @Test
    void jwtVapidFirmatoConAudienceDelServizio() throws Exception {
        KeyPair vapid = ChiaviEc.nuovaCoppia();
        // Scalare in 32 byte (BigInteger può avere uno zero in testa).
        byte[] s = ((ECPrivateKey) vapid.getPrivate()).getS().toByteArray();
        byte[] s32 = new byte[32];
        System.arraycopy(s, Math.max(0, s.length - 32), s32, Math.max(0, 32 - s.length), Math.min(32, s.length));
        WebPushClient client = new WebPushClient(
                ChiaviEc.inBase64Url(ChiaviEc.puntoNonCompresso((ECPublicKey) vapid.getPublic())),
                ChiaviEc.inBase64Url(s32), "mailto:test@example.com");

        SignedJWT jwt = SignedJWT.parse(client.jwt(URI.create("https://fcm.googleapis.com/fcm/send/abc")));

        assertThat(jwt.verify(new ECDSAVerifier((ECPublicKey) vapid.getPublic()))).isTrue();
        assertThat(jwt.getJWTClaimsSet().getAudience()).containsExactly("https://fcm.googleapis.com");
        assertThat(jwt.getJWTClaimsSet().getSubject()).isEqualTo("mailto:test@example.com");
        assertThat(jwt.getJWTClaimsSet().getExpirationTime()).isInTheFuture();
    }

    /** Lato browser (RFC 8291), per verificare il giro completo. */
    public static byte[] decifra(byte[] corpo, ECPrivateKey privataBrowser, byte[] pubblicaBrowser, byte[] auth)
            throws Exception {
        ByteBuffer buffer = ByteBuffer.wrap(corpo);
        byte[] sale = new byte[16];
        buffer.get(sale);
        buffer.getInt();
        byte[] pubblicaServer = new byte[buffer.get()];
        buffer.get(pubblicaServer);
        byte[] cifrato = new byte[buffer.remaining()];
        buffer.get(cifrato);

        KeyAgreement accordo = KeyAgreement.getInstance("ECDH");
        accordo.init(privataBrowser);
        accordo.doPhase(ChiaviEc.pubblica(pubblicaServer), true);
        byte[] ecdh = accordo.generateSecret();
        byte[] info = ByteBuffer.allocate(14 + 65 + 65).put("WebPush: info\0".getBytes(StandardCharsets.US_ASCII))
                .put(pubblicaBrowser).put(pubblicaServer).array();
        byte[] ikm = hkdf(auth, ecdh, info, 32);
        byte[] cek = hkdf(sale, ikm, "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), 16);
        byte[] nonce = hkdf(sale, ikm, "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), 12);
        Cipher aes = Cipher.getInstance("AES/GCM/NoPadding");
        aes.init(Cipher.DECRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] chiaro = aes.doFinal(cifrato);
        int fine = chiaro.length - 1;
        while (chiaro[fine] == 0) {
            fine--;
        }
        assertThat(chiaro[fine]).isEqualTo((byte) 2);
        return Arrays.copyOf(chiaro, fine);
    }

    private static byte[] hkdf(byte[] sale, byte[] ikm, byte[] info, int lunghezza) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(sale, "HmacSHA256"));
        byte[] prk = mac.doFinal(ikm);
        mac.init(new SecretKeySpec(prk, "HmacSHA256"));
        mac.update(info);
        mac.update((byte) 1);
        return Arrays.copyOf(mac.doFinal(), lunghezza);
    }
}
