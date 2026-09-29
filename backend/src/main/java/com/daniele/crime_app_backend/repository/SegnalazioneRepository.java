package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.entity.Segnalazione;
import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface SegnalazioneRepository extends JpaRepository<Segnalazione, Long>,
        JpaSpecificationExecutor<Segnalazione> {

    List<Segnalazione> findByStato(StatoSegnalazione stato);

    /** Usata dal job schedulato per trovare le segnalazioni ATTIVA da far scadere. */
    List<Segnalazione> findByStatoAndDataScadenzaBefore(StatoSegnalazione stato, LocalDateTime istante);

    List<Segnalazione> findByAutoreId(Long autoreId);

    /**
     * Segnalazioni ATTIVA entro un raggio (in metri) da un punto, per le notifiche
     * di prossimità e la vista mappa. Al massimo {@code limite}: prima le più gravi e recenti. Query nativa perché sfrutta ST_DWithin su
     * colonna geography, funzione PostGIS non mappata direttamente in JPQL.
     */
    @Query(value = """
            SELECT s.* FROM segnalazione s
            JOIN categoria c ON c.id = s.categoria_id
            WHERE s.stato = 'ATTIVA'
              AND ST_DWithin(s.posizione, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :raggioMetri)
            ORDER BY c.gravita DESC, s.data_creazione DESC, s.id DESC
            LIMIT :limite
            """, nativeQuery = true)
    List<Segnalazione> trovaAttiveNelRaggio(@Param("lat") double lat,
                                             @Param("lng") double lng,
                                             @Param("raggioMetri") double raggioMetri,
                                             @Param("limite") int limite);
}
