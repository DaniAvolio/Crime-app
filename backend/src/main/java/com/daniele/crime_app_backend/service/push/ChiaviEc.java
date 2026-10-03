package com.daniele.crime_app_backend.service.push;

import java.math.BigInteger;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;
import java.util.Base64;

/**
 * Chiavi EC P-256 nei formati di Web Push: pubblica come punto non compresso (65 byte,
 * 0x04 || x || y), privata come scalare di 32 byte, entrambe in base64url senza padding.
 */
final class ChiaviEc {

    private static final ECParameterSpec P256 = parametri();

    private ChiaviEc() {
    }

    private static ECParameterSpec parametri() {
        try {
            KeyPairGenerator generatore = KeyPairGenerator.getInstance("EC");
            generatore.initialize(new ECGenParameterSpec("secp256r1"));
            return ((ECPublicKey) generatore.generateKeyPair().getPublic()).getParams();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("P-256 non disponibile", e);
        }
    }

    static KeyPair nuovaCoppia() throws GeneralSecurityException {
        KeyPairGenerator generatore = KeyPairGenerator.getInstance("EC");
        generatore.initialize(new ECGenParameterSpec("secp256r1"));
        return generatore.generateKeyPair();
    }

    static ECPublicKey pubblica(byte[] puntoNonCompresso) throws GeneralSecurityException {
        if (puntoNonCompresso.length != 65 || puntoNonCompresso[0] != 4) {
            throw new GeneralSecurityException("Chiave pubblica P-256 non valida");
        }
        BigInteger x = new BigInteger(1, Arrays.copyOfRange(puntoNonCompresso, 1, 33));
        BigInteger y = new BigInteger(1, Arrays.copyOfRange(puntoNonCompresso, 33, 65));
        return (ECPublicKey) KeyFactory.getInstance("EC")
                .generatePublic(new ECPublicKeySpec(new ECPoint(x, y), P256));
    }

    static ECPrivateKey privata(byte[] scalare) throws GeneralSecurityException {
        return (ECPrivateKey) KeyFactory.getInstance("EC")
                .generatePrivate(new ECPrivateKeySpec(new BigInteger(1, scalare), P256));
    }

    static byte[] puntoNonCompresso(ECPublicKey chiave) {
        byte[] punto = new byte[65];
        punto[0] = 4;
        copiaA32(chiave.getW().getAffineX().toByteArray(), punto, 1);
        copiaA32(chiave.getW().getAffineY().toByteArray(), punto, 33);
        return punto;
    }

    /** Coordinata in 32 byte esatti: BigInteger può aggiungere uno zero in testa o averne meno. */
    private static void copiaA32(byte[] valore, byte[] destinazione, int inizio) {
        int lunghezza = Math.min(valore.length, 32);
        System.arraycopy(valore, valore.length - lunghezza, destinazione, inizio + 32 - lunghezza, lunghezza);
    }

    static byte[] daBase64Url(String testo) {
        return Base64.getUrlDecoder().decode(testo.trim().replace('+', '-').replace('/', '_').replace("=", ""));
    }

    static String inBase64Url(byte[] dati) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(dati);
    }
}
