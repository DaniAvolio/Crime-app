package com.daniele.crime_app_backend.controller;

import com.daniele.crime_app_backend.dto.DeviceTokenDto;
import com.daniele.crime_app_backend.dto.DeviceTokenRequest;
import com.daniele.crime_app_backend.service.DeviceTokenService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Device token push dell'utente autenticato. */
@RestController
public class DeviceTokenController {

    private final DeviceTokenService deviceTokenService;

    public DeviceTokenController(DeviceTokenService deviceTokenService) {
        this.deviceTokenService = deviceTokenService;
    }

    @GetMapping("/api/utenti/me/device-token")
    public List<DeviceTokenDto> elenca() {
        return deviceTokenService.trovaPerUtenteCorrente();
    }

    @PostMapping("/api/utenti/me/device-token")
    public DeviceTokenDto registra(@Valid @RequestBody DeviceTokenRequest request) {
        return deviceTokenService.registra(request);
    }

    @DeleteMapping("/api/device-token/{token}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void rimuovi(@PathVariable String token) {
        deviceTokenService.rimuovi(token);
    }
}
