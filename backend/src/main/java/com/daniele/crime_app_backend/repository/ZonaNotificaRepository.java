package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.entity.ZonaNotifica;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ZonaNotificaRepository extends JpaRepository<ZonaNotifica, Long> {

    List<ZonaNotifica> findByUtenteIdOrderByDataCreazioneAsc(Long utenteId);

    Optional<ZonaNotifica> findByIdAndUtenteId(Long id, Long utenteId);

    long countByUtenteId(Long utenteId);
}
