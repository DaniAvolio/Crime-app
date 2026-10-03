package com.daniele.crime_app_backend.entity.enums;

/**
 * Decisione dell'admin sugli abusi in attesa di una Segnalazione. Aggiorna la fiducia dei
 * segnalanti (e dell'autore se FONDATO), vedi SegnalazioneService.decidiRevisione.
 */
public enum EsitoAbuso {
    FONDATO,
    INFONDATO
}
