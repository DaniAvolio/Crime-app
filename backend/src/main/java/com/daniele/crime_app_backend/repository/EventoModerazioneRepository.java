package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.entity.EventoModerazione;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EventoModerazioneRepository extends JpaRepository<EventoModerazione, Long> {

    List<EventoModerazione> findBySegnalazioneIdOrderByDataEventoDesc(Long segnalazioneId);
}
