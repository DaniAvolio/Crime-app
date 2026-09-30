package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.entity.SegnalazioneAbuso;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SegnalazioneAbusoRepository extends JpaRepository<SegnalazioneAbuso, Long> {

    List<SegnalazioneAbuso> findBySegnalazioneId(Long segnalazioneId);

    long countBySegnalazioneId(Long segnalazioneId);

    /** Un utente può segnalare abuso una sola volta per Segnalazione (vedi vincolo DB). */
    boolean existsBySegnalazioneIdAndUtenteId(Long segnalazioneId, Long utenteId);

    /** Usata dall'eliminazione definitiva di una Segnalazione (la FK non ha ON DELETE CASCADE). */
    @Modifying
    @Query("delete from SegnalazioneAbuso x where x.segnalazione.id = :segnalazioneId")
    void eliminaPerSegnalazione(@Param("segnalazioneId") Long segnalazioneId);

    /** Anonimizzazione dello storico: chi ha segnalato l'abuso e il motivo non servono più. */
    @Modifying
    @Query("delete from SegnalazioneAbuso x where x.segnalazione.id in :segnalazioniId")
    void eliminaPerSegnalazioni(@Param("segnalazioniId") java.util.Collection<Long> segnalazioniId);
}
