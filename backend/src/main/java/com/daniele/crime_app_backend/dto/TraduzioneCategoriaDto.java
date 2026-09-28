package com.daniele.crime_app_backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Nome e descrizione di una categoria in una lingua; usato sia in ingresso che in uscita. */
public record TraduzioneCategoriaDto(
        @NotBlank(message = "Il nome tradotto della categoria è obbligatorio")
        @Size(max = 100, message = "Il nome tradotto non può superare 100 caratteri")
        String nome,

        @Size(max = 500, message = "La descrizione tradotta non può superare 500 caratteri")
        String descrizione
) {}
