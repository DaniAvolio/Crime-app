package com.daniele.crime_app_backend.dto;

/** Segnalazioni in un giorno della settimana (1 = lunedì ... 7 = domenica) e ora (0–23). */
public record FasciaOrariaDto(int giornoSettimana, int ora, long numero) {}
