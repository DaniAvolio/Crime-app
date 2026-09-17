package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.entity.DeviceToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DeviceTokenRepository extends JpaRepository<DeviceToken, Long> {

    List<DeviceToken> findByUtenteId(Long utenteId);

    Optional<DeviceToken> findByToken(String token);

    void deleteByToken(String token);
}
