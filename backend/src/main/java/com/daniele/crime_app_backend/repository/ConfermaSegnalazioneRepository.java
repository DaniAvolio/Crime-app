package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.entity.ConfermaSegnalazione;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ConfermaSegnalazioneRepository extends JpaRepository<ConfermaSegnalazione, Long> {

    /** Un voto per utente per Segnalazione (vedi vincolo DB): se esiste va aggiornato. */
    Optional<ConfermaSegnalazione> findBySegnalazioneIdAndUtenteId(Long segnalazioneId, Long utenteId);

    /** Voti dell'utente su un elenco di segnalazioni (una sola query per tutta la vista mappa). */
    List<ConfermaSegnalazione> findByUtenteIdAndSegnalazioneIdIn(Long utenteId, Collection<Long> segnalazioniId);

    /** Voti "non più in atto" espressi dopo un certo istante (l'ultima conferma positiva). */
    long countBySegnalazioneIdAndAncoraInAttoFalseAndDataVotoAfter(Long segnalazioneId, LocalDateTime istante);

    /**
     * Qualcuno diverso dall'utente indicato (l'autore) ha già dato un "sì" che ha prolungato
     * (dataUltimoSi valorizzata): la segnalazione conta già come confermata.
     */
    boolean existsBySegnalazioneIdAndUtenteIdNotAndDataUltimoSiIsNotNull(Long segnalazioneId, Long utenteId);

    /** Anonimizzazione dello storico: i voti delle segnalazioni vecchie non servono più. */
    @Modifying
    @Query("delete from ConfermaSegnalazione x where x.segnalazione.id in :segnalazioniId")
    void eliminaPerSegnalazioni(@Param("segnalazioniId") Collection<Long> segnalazioniId);

    /** Usata dall'eliminazione definitiva di una Segnalazione (la FK non ha ON DELETE CASCADE). */
    @Modifying
    @Query("delete from ConfermaSegnalazione x where x.segnalazione.id = :segnalazioneId")
    void eliminaPerSegnalazione(@Param("segnalazioneId") Long segnalazioneId);
}
