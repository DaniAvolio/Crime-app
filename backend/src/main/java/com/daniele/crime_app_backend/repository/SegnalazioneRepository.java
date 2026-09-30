package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.entity.Segnalazione;
import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    long countByAutoreId(Long autoreId);

    long countByAutoreIdAndStato(Long autoreId, StatoSegnalazione stato);

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

    /**
     * Vista lista: segnalazioni ATTIVA nel raggio dalla più vicina, a pagine, con filtri opzionali
     * (null = nessun filtro). A differenza della mappa non c'è tetto: ordinando per distanza nel
     * database la lista resta corretta anche con migliaia di segnalazioni nella zona.
     * I CAST servono a PostgreSQL per tipizzare i parametri quando valgono null.
     */
    @Query(value = """
            SELECT s.* FROM segnalazione s
            JOIN categoria c ON c.id = s.categoria_id
            WHERE s.stato = 'ATTIVA'
              AND ST_DWithin(s.posizione, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :raggioMetri)
              AND (CAST(:gravita AS integer) IS NULL OR c.gravita = CAST(:gravita AS integer))
              AND (CAST(:categoriaId AS bigint) IS NULL OR s.categoria_id = CAST(:categoriaId AS bigint))
            ORDER BY ST_Distance(s.posizione, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography), s.id
            """,
            countQuery = """
            SELECT count(*) FROM segnalazione s
            JOIN categoria c ON c.id = s.categoria_id
            WHERE s.stato = 'ATTIVA'
              AND ST_DWithin(s.posizione, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :raggioMetri)
              AND (CAST(:gravita AS integer) IS NULL OR c.gravita = CAST(:gravita AS integer))
              AND (CAST(:categoriaId AS bigint) IS NULL OR s.categoria_id = CAST(:categoriaId AS bigint))
            """,
            nativeQuery = true)
    Page<Segnalazione> trovaAttiveNelRaggioPerDistanza(@Param("lat") double lat,
                                                        @Param("lng") double lng,
                                                        @Param("raggioMetri") double raggioMetri,
                                                        @Param("gravita") Integer gravita,
                                                        @Param("categoriaId") Long categoriaId,
                                                        Pageable pagina);

    /** Proiezione di {@link #contaAttiveNelRaggioPerCategoria}. */
    interface ConteggioCategoria {
        Long getCategoriaId();

        long getNumero();
    }

    /** Segnalazioni ATTIVA nel raggio per categoria (filtro gravità opzionale): chip della lista. */
    @Query(value = """
            SELECT s.categoria_id AS categoriaId, count(*) AS numero FROM segnalazione s
            JOIN categoria c ON c.id = s.categoria_id
            WHERE s.stato = 'ATTIVA'
              AND ST_DWithin(s.posizione, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :raggioMetri)
              AND (CAST(:gravita AS integer) IS NULL OR c.gravita = CAST(:gravita AS integer))
            GROUP BY s.categoria_id
            """, nativeQuery = true)
    List<ConteggioCategoria> contaAttiveNelRaggioPerCategoria(@Param("lat") double lat,
                                                             @Param("lng") double lng,
                                                             @Param("raggioMetri") double raggioMetri,
                                                             @Param("gravita") Integer gravita);
}
