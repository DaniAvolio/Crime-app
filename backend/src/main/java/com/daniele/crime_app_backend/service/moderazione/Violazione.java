package com.daniele.crime_app_backend.service.moderazione;

/** Un controllo bloccante non superato dalla descrizione, con il pezzo di testo che lo fa scattare. */
public record Violazione(TipoViolazione tipo, String frammento) {}
