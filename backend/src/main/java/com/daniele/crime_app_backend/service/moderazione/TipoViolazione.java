package com.daniele.crime_app_backend.service.moderazione;

/**
 * Controlli sulla descrizione di una segnalazione (vedi ValidatoreDescrizione). I bloccanti
 * impediscono la pubblicazione; i soft la consentono ma mettono la segnalazione nella coda
 * "da rivedere" dell'admin. Il client traduce il codice in un messaggio.
 */
public enum TipoViolazione {
    TROPPO_CORTA(true),
    DATI_PERSONALI(true),
    LINK(true),
    LINGUAGGIO_OFFENSIVO(true),
    DISCRIMINAZIONE(true),
    MAIUSCOLE(false),
    RIPETIZIONI(false);

    private final boolean bloccante;

    TipoViolazione(boolean bloccante) {
        this.bloccante = bloccante;
    }

    public boolean isBloccante() {
        return bloccante;
    }
}
