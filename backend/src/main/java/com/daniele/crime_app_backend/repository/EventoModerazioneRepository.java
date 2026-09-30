package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.entity.EventoModerazione;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface EventoModerazioneRepository extends JpaRepository<EventoModerazione, Long> {

    List<EventoModerazione> findBySegnalazioneIdOrderByDataEventoDesc(Long segnalazioneId);

    /** Usata dall'eliminazione definitiva di una Segnalazione (la FK non ha ON DELETE CASCADE). */
    @Modifying
    @Query("delete from EventoModerazione x where x.segnalazione.id = :segnalazioneId")
    void eliminaPerSegnalazione(@Param("segnalazioneId") Long segnalazioneId);

    /**
     * Anonimizzazione dello storico: le motivazioni (testo libero) si tolgono, gli eventi restano
     * come registro delle transizioni.
     */
    @Modifying
    @Query("update EventoModerazione x set x.motivazione = null where x.segnalazione.id in :segnalazioniId")
    void cancellaMotivazioni(@Param("segnalazioniId") java.util.Collection<Long> segnalazioniId);
}
