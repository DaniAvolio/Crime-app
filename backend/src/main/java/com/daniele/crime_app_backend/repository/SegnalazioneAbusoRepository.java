package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.entity.SegnalazioneAbuso;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SegnalazioneAbusoRepository extends JpaRepository<SegnalazioneAbuso, Long> {

    List<SegnalazioneAbuso> findBySegnalazioneId(Long segnalazioneId);

    long countBySegnalazioneId(Long segnalazioneId);

    /** Un utente può segnalare abuso una sola volta per Segnalazione (vedi vincolo DB). */
    boolean existsBySegnalazioneIdAndUtenteId(Long segnalazioneId, Long utenteId);
}
