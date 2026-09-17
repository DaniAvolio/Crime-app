package com.daniele.crime_app_backend.entity.enums;

/**
 * Stati del ciclo di vita di una Segnalazione.
 * Nessuno step di revisione umana bloccante: si entra in ATTIVA subito dopo
 * il filtro automatico sul testo (se il filtro fallisce, la segnalazione non
 * viene salvata). La moderazione manuale è reattiva, non preventiva.
 */
public enum StatoSegnalazione {
    ATTIVA,
    SCADUTA,
    SOSPESA,
    RIMOSSA
}
