package com.daniele.crime_app_backend.dto;

/** Quante segnalazioni attive di una categoria ci sono in un raggio (chip dei filtri della lista). */
public record ConteggioCategoriaDto(Long categoriaId, long numero) {}
