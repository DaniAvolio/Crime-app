package com.daniele.crime_app_backend.exception;

import com.daniele.crime_app_backend.service.moderazione.Violazione;

import java.util.List;
import java.util.stream.Collectors;

/** Descrizione che non supera i controlli bloccanti di moderazione: 400 con l'elenco delle violazioni. */
public class DescrizioneNonValidaException extends RuntimeException {

    private final List<Violazione> violazioni;

    public DescrizioneNonValidaException(List<Violazione> violazioni) {
        super("Descrizione non pubblicabile: " + violazioni.stream()
                .map(v -> v.tipo() + " (" + v.frammento() + ")")
                .collect(Collectors.joining(", ")));
        this.violazioni = List.copyOf(violazioni);
    }

    public List<Violazione> getViolazioni() {
        return violazioni;
    }
}
