package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.entity.enums.RuoloUtente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UtenteRepository extends JpaRepository<Utente, Long>, JpaSpecificationExecutor<Utente> {

    Optional<Utente> findByEmail(String email);

    Optional<Utente> findByEmailIgnoreCase(String email);

    long countByRuoloAndAttivoTrue(RuoloUtente ruolo);

    boolean existsByEmail(String email);

    // Contatori di attività (vedi Utente): update atomici, sicuri con eventi contemporanei.

    @Modifying
    @Query("update Utente u set u.segnalazioniFatte = u.segnalazioniFatte + 1 where u.id = :id")
    void incrementaSegnalazioniFatte(@Param("id") Long id);

    @Modifying
    @Query("update Utente u set u.segnalazioniConfermate = u.segnalazioniConfermate + 1 where u.id = :id")
    void incrementaSegnalazioniConfermate(@Param("id") Long id);

    @Modifying
    @Query("update Utente u set u.segnalazioniRimosse = u.segnalazioniRimosse + 1 where u.id = :id")
    void incrementaSegnalazioniRimosse(@Param("id") Long id);

    /** Somma delta alla fiducia restando tra 0 e 100. */
    @Modifying
    @Query(value = "UPDATE utente SET punteggio_fiducia = LEAST(100, GREATEST(0, punteggio_fiducia + :delta))"
            + " WHERE id IN (:ids)", nativeQuery = true)
    void modificaFiducia(@Param("ids") java.util.Collection<Long> ids, @Param("delta") int delta);
}
