package com.daniele.crime_app_backend.dto;

/** Una cella della griglia della mappa di calore: centro e numero di segnalazioni al suo interno. */
public record CellaCaloreDto(double lat, double lng, long numero) {}
