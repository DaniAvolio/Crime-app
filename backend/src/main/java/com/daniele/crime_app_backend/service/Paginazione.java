package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.exception.RichiestaNonValidaException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Map;

/**
 * Costruisce il Pageable delle tabelle di gestione da "pagina", "dimensione" e
 * "ordina=campo,asc|desc". I campi ordinabili sono una whitelist per tabella (nome esposto al
 * client -> proprietà JPA): un campo sconosciuto è un 400, non un errore di query (500).
 */
public final class Paginazione {

    public static final int DIMENSIONE_MASSIMA = 100;

    private Paginazione() {
    }

    public static Pageable crea(int pagina, int dimensione, String ordina, Map<String, String> campiOrdinabili,
                                Sort predefinito) {
        valida(pagina, dimensione);
        Sort ordinamento = ordina == null || ordina.isBlank() ? predefinito : interpreta(ordina, campiOrdinabili);
        // Id come ultimo criterio: a parità di valore l'ordine resta stabile tra una pagina e l'altra.
        return PageRequest.of(pagina, dimensione, ordinamento.and(Sort.by("id")));
    }

    /** Pagina e dimensione validate come in {@link #crea}, senza ordinamento (lo fa la query). */
    public static Pageable senzaOrdinamento(int pagina, int dimensione) {
        valida(pagina, dimensione);
        return PageRequest.of(pagina, dimensione);
    }

    private static void valida(int pagina, int dimensione) {
        if (pagina < 0) {
            throw new RichiestaNonValidaException("Pagina non valida: " + pagina);
        }
        if (dimensione < 1 || dimensione > DIMENSIONE_MASSIMA) {
            throw new RichiestaNonValidaException("Dimensione pagina fuori dall'intervallo 1-" + DIMENSIONE_MASSIMA);
        }
    }

    private static Sort interpreta(String ordina, Map<String, String> campiOrdinabili) {
        String[] parti = ordina.split(",");
        String proprieta = campiOrdinabili.get(parti[0].trim());
        if (proprieta == null || parti.length > 2) {
            throw new RichiestaNonValidaException("Ordinamento non ammesso: " + ordina);
        }
        String verso = parti.length == 2 ? parti[1].trim().toLowerCase() : "asc";
        return switch (verso) {
            case "asc" -> Sort.by(Sort.Order.asc(proprieta));
            case "desc" -> Sort.by(Sort.Order.desc(proprieta));
            default -> throw new RichiestaNonValidaException("Verso di ordinamento non valido: " + verso);
        };
    }
}
