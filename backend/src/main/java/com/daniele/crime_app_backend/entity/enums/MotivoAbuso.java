package com.daniele.crime_app_backend.entity.enums;

/** Perché un utente segnala un problema su una Segnalazione (vedi SegnalazioneAbuso). */
public enum MotivoAbuso {
    /** Falsa o non più vera. */
    FALSA,
    /** Offensiva o discriminatoria. */
    OFFENSIVA,
    /** Contiene dati personali (nomi, targhe, telefoni...). */
    DATI_PERSONALI,
    SPAM,
    CATEGORIA_ERRATA,
    ALTRO
}
