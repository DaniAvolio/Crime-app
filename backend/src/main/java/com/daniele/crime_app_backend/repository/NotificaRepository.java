package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.entity.Notifica;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

public interface NotificaRepository extends JpaRepository<Notifica, Long> {

    /** Campanella: dalla più recente, con segnalazione e categoria già caricate. */
    @EntityGraph(attributePaths = {"segnalazione", "segnalazione.categoria"})
    Page<Notifica> findByUtenteIdOrderByDataCreazioneDescIdDesc(Long utenteId, Pageable pagina);

    long countByUtenteIdAndLettaFalse(Long utenteId);

    @Modifying
    @Query("update Notifica n set n.letta = true where n.id = :id and n.utente.id = :utenteId")
    int segnaLetta(@Param("id") Long id, @Param("utenteId") Long utenteId);

    @Modifying
    @Query("update Notifica n set n.letta = true where n.utente.id = :utenteId and n.letta = false")
    int segnaTutteLette(@Param("utenteId") Long utenteId);

    /** Push vere inviate dopo un certo istante, per utente: [utenteId, numero]. */
    @Query("select n.utente.id, count(n) from Notifica n where n.utente.id in :utentiId"
            + " and n.inviataPush = true and n.dataCreazione > :da group by n.utente.id")
    List<Object[]> contaPushDopo(@Param("utentiId") Collection<Long> utentiId, @Param("da") LocalDateTime da);

    /** Segnalazioni vicine non inviate come push dopo un certo istante (testo del riepilogo). */
    @Query("select count(n) from Notifica n where n.utente.id = :utenteId and n.inviataPush = false"
            + " and n.tipo = com.daniele.crime_app_backend.entity.enums.TipoNotifica.VICINA and n.dataCreazione > :da")
    long contaVicineSenzaPushDopo(@Param("utenteId") Long utenteId, @Param("da") LocalDateTime da);

    @Modifying
    @Query("delete from Notifica n where n.dataCreazione < :soglia")
    int eliminaPrimaDi(@Param("soglia") LocalDateTime soglia);

    /** Anonimizzazione dello storico: gli avvisi delle segnalazioni vecchie non servono più. */
    @Modifying
    @Query("delete from Notifica n where n.segnalazione.id in :segnalazioniId")
    void eliminaPerSegnalazioni(@Param("segnalazioniId") Collection<Long> segnalazioniId);

    interface Destinatario {
        Long getUtenteId();

        String getZonaNome();
    }

    /**
     * Chi avvisare di una nuova segnalazione: utenti attivi (non l'autore) con una zona che la
     * contiene, avvisi attivi, gravità sufficiente e categoria tra quelle scelte (o nessuna scelta).
     * Senza riga di preferenze valgono i default (attivi, solo gravità 3). Un utente compare una
     * sola volta, con la zona più vicina.
     */
    @Query(value = """
            SELECT DISTINCT ON (z.utente_id) z.utente_id AS utenteId, z.nome AS zonaNome
            FROM segnalazione s
            JOIN categoria c ON c.id = s.categoria_id
            JOIN zona_notifica z ON ST_DWithin(z.posizione, s.posizione, z.raggio_metri)
            JOIN utente u ON u.id = z.utente_id AND u.attivo
            LEFT JOIN preferenze_notifica p ON p.utente_id = z.utente_id
            WHERE s.id = :segnalazioneId
              AND (s.autore_id IS NULL OR z.utente_id <> s.autore_id)
              AND COALESCE(p.notifiche_attive, TRUE)
              AND c.gravita >= COALESCE(p.gravita_minima, 3)
              AND (p.id IS NULL
                   OR NOT EXISTS (SELECT 1 FROM preferenze_notifica_categoria pc WHERE pc.preferenze_id = p.id)
                   OR EXISTS (SELECT 1 FROM preferenze_notifica_categoria pc
                              WHERE pc.preferenze_id = p.id AND pc.categoria_id = s.categoria_id))
            ORDER BY z.utente_id, ST_Distance(z.posizione, s.posizione)
            """, nativeQuery = true)
    List<Destinatario> destinatariVicina(@Param("segnalazioneId") Long segnalazioneId);
}
