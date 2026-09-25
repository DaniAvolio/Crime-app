package com.daniele.crime_app_backend.controller;

import com.daniele.crime_app_backend.dto.DeviceTokenDto;
import com.daniele.crime_app_backend.dto.DeviceTokenRequest;
import com.daniele.crime_app_backend.service.DeviceTokenService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class DeviceTokenController {

    private final DeviceTokenService deviceTokenService;

    public DeviceTokenController(DeviceTokenService deviceTokenService) {
        this.deviceTokenService = deviceTokenService;
    }

    @GetMapping("/api/utenti/{utenteId}/device-token")
    public List<DeviceTokenDto> elenca(@PathVariable Long utenteId) {
        return deviceTokenService.trovaPerUtente(utenteId);
    }

    @PostMapping("/api/utenti/{utenteId}/device-token")
    public DeviceTokenDto registra(@PathVariable Long utenteId, @Valid @RequestBody DeviceTokenRequest request) {
        return deviceTokenService.registra(utenteId, request);
    }

    @DeleteMapping("/api/device-token/{token}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void rimuovi(@PathVariable String token) {
        deviceTokenService.rimuovi(token);
    }
}
