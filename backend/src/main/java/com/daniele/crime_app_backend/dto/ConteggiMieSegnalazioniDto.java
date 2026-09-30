package com.daniele.crime_app_backend.dto;

/** Quante segnalazioni ha l'utente corrente nelle due schede del profilo (senza caricarle). */
public record ConteggiMieSegnalazioniDto(long attive, long concluse) {}
