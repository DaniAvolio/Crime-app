package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.dto.FiltriCategorie;
import com.daniele.crime_app_backend.dto.FiltriSegnalazioni;
import com.daniele.crime_app_backend.dto.FiltriUtenti;
import com.daniele.crime_app_backend.entity.Categoria;
import com.daniele.crime_app_backend.entity.Segnalazione;
import com.daniele.crime_app_backend.entity.TraduzioneCategoria;
import com.daniele.crime_app_backend.entity.Utente;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.MapJoin;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
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

    public static Specification<Categoria> categorie(FiltriCategorie filtri) {
        return (root, query, cb) -> {
            List<Predicate> condizioni = new ArrayList<>();
            if (filtri.nome() != null && !filtri.nome().isBlank()) {
                // Nome italiano o una delle traduzioni: subquery, così nessun join duplica le righe.
                String modello = modelloContiene(filtri.nome());
                Subquery<Long> tradotte = query.subquery(Long.class);
                Root<Categoria> categoria = tradotte.from(Categoria.class);
                MapJoin<Categoria, String, TraduzioneCategoria> traduzione = categoria.joinMap("traduzioni");
                tradotte.select(categoria.get("id")).where(
                        cb.equal(categoria.get("id"), root.get("id")),
                        cb.like(cb.lower(traduzione.value().get("nome")), modello, '\\'));
                condizioni.add(cb.or(cb.like(cb.lower(root.get("nome")), modello, '\\'), cb.exists(tradotte)));
            }
            if (filtri.gravita() != null) {
                condizioni.add(cb.equal(root.get("gravita"), filtri.gravita()));
            }
            if (filtri.durataMin() != null) {
                condizioni.add(cb.greaterThanOrEqualTo(root.get("durataValiditaOre"), filtri.durataMin()));
            }
            if (filtri.durataMax() != null) {
                condizioni.add(cb.lessThanOrEqualTo(root.get("durataValiditaOre"), filtri.durataMax()));
            }
            if (filtri.attiva() != null) {
                condizioni.add(cb.equal(root.get("attiva"), filtri.attiva()));
            }
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
        condizioni.add(cb.like(cb.lower(campo), modelloContiene(testo), '\\'));
    }

    /** Modello LIKE "%testo%" in minuscolo, con \ % _ dell'utente resi letterali (escape '\'). */
    private static String modelloContiene(String testo) {
        String escape = testo.trim().toLowerCase()
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escape + "%";
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
