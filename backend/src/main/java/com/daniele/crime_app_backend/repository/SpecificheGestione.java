package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.dto.FiltriSegnalazioni;
import com.daniele.crime_app_backend.dto.FiltriUtenti;
import com.daniele.crime_app_backend.entity.Segnalazione;
import com.daniele.crime_app_backend.entity.Utente;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** Filtri delle tabelle di gestione tradotti in Specification JPA; i filtri null o vuoti sono ignorati. */
public final class SpecificheGestione {

    private SpecificheGestione() {
    }

    public static Specification<Segnalazione> segnalazioni(FiltriSegnalazioni filtri) {
        return (root, query, cb) -> {
            List<Predicate> condizioni = new ArrayList<>();
            if (filtri.id() != null) {
                condizioni.add(cb.equal(root.get("id"), filtri.id()));
            }
            if (filtri.categoriaId() != null) {
                condizioni.add(cb.equal(root.get("categoria").get("id"), filtri.categoriaId()));
            }
            aggiungiContiene(condizioni, cb, root.get("descrizione"), filtri.descrizione());
            if (filtri.anonima() != null) {
                condizioni.add(cb.equal(root.get("anonima"), filtri.anonima()));
            }
            if (filtri.stato() != null) {
                condizioni.add(cb.equal(root.get("stato"), filtri.stato()));
            }
            aggiungiIntervalloGiorni(condizioni, cb, root.get("dataCreazione"), filtri.creataDal(), filtri.creataAl());
            aggiungiIntervalloGiorni(condizioni, cb, root.get("dataScadenza"), filtri.scadeDal(), filtri.scadeAl());
            return cb.and(condizioni.toArray(Predicate[]::new));
        };
    }

    public static Specification<Utente> utenti(FiltriUtenti filtri) {
        return (root, query, cb) -> {
            List<Predicate> condizioni = new ArrayList<>();
            aggiungiContiene(condizioni, cb, root.get("nome"), filtri.nome());
            aggiungiContiene(condizioni, cb, root.get("cognome"), filtri.cognome());
            aggiungiContiene(condizioni, cb, root.get("email"), filtri.email());
            if (filtri.identitaVerificata() != null) {
                condizioni.add(cb.equal(root.get("identitaVerificata"), filtri.identitaVerificata()));
            }
            if (filtri.fiduciaMin() != null) {
                condizioni.add(cb.greaterThanOrEqualTo(root.get("punteggioFiducia"), filtri.fiduciaMin()));
            }
            if (filtri.fiduciaMax() != null) {
                condizioni.add(cb.lessThanOrEqualTo(root.get("punteggioFiducia"), filtri.fiduciaMax()));
            }
            if (filtri.attivo() != null) {
                condizioni.add(cb.equal(root.get("attivo"), filtri.attivo()));
            }
            if (filtri.ruolo() != null) {
                condizioni.add(cb.equal(root.get("ruolo"), filtri.ruolo()));
            }
            return cb.and(condizioni.toArray(Predicate[]::new));
        };
    }

    /** "Contiene", senza distinzione di maiuscole; % e _ scritti dall'utente valgono come caratteri. */
    private static void aggiungiContiene(List<Predicate> condizioni, CriteriaBuilder cb, Expression<String> campo,
                                         String testo) {
        if (testo == null || testo.isBlank()) {
            return;
        }
        String escape = testo.trim().toLowerCase()
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        condizioni.add(cb.like(cb.lower(campo), "%" + escape + "%", '\\'));
    }

    /** Estremi inclusi, a giorni interi: "al" arriva fino alla fine di quel giorno. */
    private static void aggiungiIntervalloGiorni(List<Predicate> condizioni, CriteriaBuilder cb,
                                                 Expression<LocalDateTime> campo, LocalDate dal, LocalDate al) {
        if (dal != null) {
            condizioni.add(cb.greaterThanOrEqualTo(campo, dal.atStartOfDay()));
        }
        if (al != null) {
            condizioni.add(cb.lessThan(campo, al.plusDays(1).atStartOfDay()));
        }
    }
}
