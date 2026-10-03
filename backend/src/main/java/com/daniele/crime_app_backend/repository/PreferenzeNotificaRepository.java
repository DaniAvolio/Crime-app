package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.entity.PreferenzeNotifica;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PreferenzeNotificaRepository extends JpaRepository<PreferenzeNotifica, Long> {

    Optional<PreferenzeNotifica> findByUtenteId(Long utenteId);

    List<PreferenzeNotifica> findByUtenteIdIn(java.util.Collection<Long> utentiId);
}
