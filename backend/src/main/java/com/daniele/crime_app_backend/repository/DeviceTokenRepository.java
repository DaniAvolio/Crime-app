package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.entity.DeviceToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/** Sottoscrizioni Web Push (vedi DeviceToken): token = endpoint del servizio push. */
public interface DeviceTokenRepository extends JpaRepository<DeviceToken, Long> {

    List<DeviceToken> findByUtenteId(Long utenteId);

    List<DeviceToken> findByUtenteIdIn(java.util.Collection<Long> utentiId);

    Optional<DeviceToken> findByToken(String token);

    /** Sottoscrizione revocata dal browser (404/410): non serve più a nulla. */
    @Modifying
    @Query("delete from DeviceToken d where d.token = :token")
    void eliminaPerToken(@Param("token") String token);
}
