package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.entity.ConfermaSegnalazione;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;

public interface ConfermaSegnalazioneRepository extends JpaRepository<ConfermaSegnalazione, Long> {

    /** Un voto per utente per Segnalazione (vedi vincolo DB): se esiste va aggiornato. */
    Optional<ConfermaSegnalazione> findBySegnalazioneIdAndUtenteId(Long segnalazioneId, Long utenteId);

    /** Voti "non più in atto" espressi dopo un certo istante (l'ultima conferma positiva). */
    long countBySegnalazioneIdAndAncoraInAttoFalseAndDataVotoAfter(Long segnalazioneId, LocalDateTime istante);
}
