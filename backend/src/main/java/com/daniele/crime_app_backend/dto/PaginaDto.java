package com.daniele.crime_app_backend.dto;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/**
 * Una pagina di risultati per le tabelle di gestione. DTO esplicito invece di serializzare
 * PageImpl, il cui JSON non è un formato stabile garantito da Spring Data.
 */
public record PaginaDto<T>(
        List<T> contenuto,
        int pagina,
        int dimensione,
        long totaleElementi,
        int totalePagine
) {
    public static <E, T> PaginaDto<T> da(Page<E> pagina, Function<E, T> mapper) {
        return new PaginaDto<>(pagina.getContent().stream().map(mapper).toList(), pagina.getNumber(),
                pagina.getSize(), pagina.getTotalElements(), pagina.getTotalPages());
    }
}
