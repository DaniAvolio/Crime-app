package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.entity.SegnalazioneAbuso;
import com.daniele.crime_app_backend.entity.enums.EsitoAbuso;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SegnalazioneAbusoRepository extends JpaRepository<SegnalazioneAbuso, Long> {

    List<SegnalazioneAbuso> findBySegnalazioneIdOrderByDataSegnalazioneDesc(Long segnalazioneId);

    /** Su quali delle segnalazioni date l'utente ha già segnalato un problema (una query per vista). */
    @Query("select a.segnalazione.id from SegnalazioneAbuso a"
            + " where a.utente.id = :utenteId and a.segnalazione.id in :segnalazioniId")
    List<Long> segnalazioniConAbusoDi(@Param("utenteId") Long utenteId,
                                      @Param("segnalazioniId") java.util.Collection<Long> segnalazioniId);

    /** Chi ha segnalato abusi ancora in attesa: la sua fiducia cambia con la decisione dell'admin. */
    @Query("select a.utente.id from SegnalazioneAbuso a where a.segnalazione.id = :segnalazioneId and a.esito is null")
    List<Long> segnalantiInAttesa(@Param("segnalazioneId") Long segnalazioneId);

    @Modifying
    @Query("update SegnalazioneAbuso a set a.esito = :esito where a.segnalazione.id = :segnalazioneId and a.esito is null")
    void registraEsito(@Param("segnalazioneId") Long segnalazioneId, @Param("esito") EsitoAbuso esito);

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
