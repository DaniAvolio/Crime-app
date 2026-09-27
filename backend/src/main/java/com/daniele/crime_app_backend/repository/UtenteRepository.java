package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.entity.enums.RuoloUtente;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UtenteRepository extends JpaRepository<Utente, Long> {

    Optional<Utente> findByEmail(String email);

    Optional<Utente> findByEmailIgnoreCase(String email);

    long countByRuoloAndAttivoTrue(RuoloUtente ruolo);

    boolean existsByEmail(String email);
}
