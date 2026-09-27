package com.daniele.crime_app_backend.controller;

import com.daniele.crime_app_backend.dto.AuthResponse;
import com.daniele.crime_app_backend.dto.LoginRequest;
import com.daniele.crime_app_backend.dto.UtenteDto;
import com.daniele.crime_app_backend.dto.UtenteRegistrazioneRequest;
import com.daniele.crime_app_backend.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/registrazione")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse registra(@Valid @RequestBody UtenteRegistrazioneRequest request) {
        return authService.registra(request);
    }

    @GetMapping("/me")
    public UtenteDto me() {
        return authService.utenteCorrente();
    }
}
