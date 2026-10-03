package com.daniele.crime_app_backend.dto;

import java.time.LocalDate;

/** Segnalazioni create in un giorno, settimana (dal lunedì) o mese, indicato dal suo primo giorno. */
public record PuntoAndamentoDto(LocalDate periodo, long numero) {}
