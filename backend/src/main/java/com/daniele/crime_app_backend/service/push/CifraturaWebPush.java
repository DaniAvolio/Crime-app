package com.daniele.crime_app_backend.service.push;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.SecureRandom;
import java.security.interfaces.ECPublicKey;
import java.util.Arrays;

/**
 * Cifratura del contenuto di una push secondo RFC 8291 (Message Encryption for Web Push) con
 * codifica "aes128gcm" (RFC 8188), un solo record. Solo JDK: ECDH P-256, HKDF-SHA256, AES-128-GCM.
 */
final class CifraturaWebPush {

    /** Dimensione del record dichiarata nell'intestazione; il contenuto ne usa uno solo. */
    private static final int DIMENSIONE_RECORD = 4096;
    /** Spazio massimo del testo in chiaro: record meno tag GCM (16) e delimitatore (1). */
    static final int CONTENUTO_MASSIMO = DIMENSIONE_RECORD - 17;

    private static final SecureRandom CASUALE = new SecureRandom();

    private CifraturaWebPush() {
    }

    /** Cifra con una coppia di chiavi effimera e un sale casuali, come richiesto per ogni push. */
    static byte[] cifra(byte[] testo, byte[] chiaveBrowser, byte[] segretoAuth) throws GeneralSecurityException {
        byte[] sale = new byte[16];
        CASUALE.nextBytes(sale);
        return cifra(testo, chiaveBrowser, segretoAuth, ChiaviEc.nuovaCoppia(), sale);
    }

    /** Versione deterministica (chiavi del server e sale dati), per i vettori di prova dell'RFC. */
    static byte[] cifra(byte[] testo, byte[] chiaveBrowser, byte[] segretoAuth, KeyPair server, byte[] sale)
            throws GeneralSecurityException {
        if (testo.length > CONTENUTO_MASSIMO) {
            throw new GeneralSecurityException("Contenuto della push troppo lungo: " + testo.length + " byte");
        }
        ECPublicKey pubblicaBrowser = ChiaviEc.pubblica(chiaveBrowser);
        byte[] pubblicaServer = ChiaviEc.puntoNonCompresso((ECPublicKey) server.getPublic());

        KeyAgreement accordo = KeyAgreement.getInstance("ECDH");
        accordo.init(server.getPrivate());
        accordo.doPhase(pubblicaBrowser, true);
        byte[] segretoEcdh = accordo.generateSecret();

        // IKM = HKDF(auth, ecdh, "WebPush: info" || 0 || ua_public || as_public, 32)
        byte[] infoChiave = concatena("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), chiaveBrowser, pubblicaServer);
        byte[] ikm = hkdf(segretoAuth, segretoEcdh, infoChiave, 32);

        byte[] cek = hkdf(sale, ikm, "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), 16);
        byte[] nonce = hkdf(sale, ikm, "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), 12);

        // Un solo record, l'ultimo: delimitatore 0x02, nessun riempimento.
        byte[] inChiaro = Arrays.copyOf(testo, testo.length + 1);
        inChiaro[testo.length] = 2;
        Cipher aes = Cipher.getInstance("AES/GCM/NoPadding");
        aes.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] cifrato = aes.doFinal(inChiaro);

        // Intestazione: salt (16) || rs (4) || idlen (1) || keyid (= chiave pubblica del server)
        ByteBuffer corpo = ByteBuffer.allocate(16 + 4 + 1 + pubblicaServer.length + cifrato.length);
        corpo.put(sale).putInt(DIMENSIONE_RECORD).put((byte) pubblicaServer.length).put(pubblicaServer).put(cifrato);
        return corpo.array();
    }

    /** HKDF-SHA256 (RFC 5869) per lunghezze fino a 32 byte: un solo blocco di espansione. */
    private static byte[] hkdf(byte[] sale, byte[] ikm, byte[] info, int lunghezza) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(sale, "HmacSHA256"));
        byte[] prk = mac.doFinal(ikm);
        mac.init(new SecretKeySpec(prk, "HmacSHA256"));
        mac.update(info);
        mac.update((byte) 1);
        return Arrays.copyOf(mac.doFinal(), lunghezza);
    }

    private static byte[] concatena(byte[]... parti) {
        ByteArrayOutputStream uscita = new ByteArrayOutputStream();
        for (byte[] parte : parti) {
            uscita.writeBytes(parte);
        }
        return uscita.toByteArray();
    }
}
