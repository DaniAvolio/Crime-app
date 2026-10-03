package com.daniele.crime_app_backend.dto;

/** Filtro "Revisione" della tabella segnalazioni in gestione. */
public enum FiltroRevisione {
    /** In coda: abusi in attesa o controlli automatici scattati. */
    DA_RIVEDERE,
    /** Con almeno un abuso in attesa. */
    CON_ABUSI,
    /** In coda per i controlli automatici sulla descrizione. */
    AUTOMATICA
}
