package com.daniele.crime_app_backend.config;

import com.daniele.crime_app_backend.service.UtenteService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * All'avvio promuove ad ADMIN l'utente indicato da crimeapp.auth.admin-email
 * (variabile d'ambiente CRIMEAPP_ADMIN_EMAIL), se è già registrato. Serve solo
 * a creare il primo amministratore senza intervenire a mano sul DB.
 */
@Component
public class AdminInizialeRunner implements ApplicationRunner {

    private final UtenteService utenteService;

    public AdminInizialeRunner(UtenteService utenteService) {
        this.utenteService = utenteService;
    }

    @Override
    public void run(ApplicationArguments args) {
        utenteService.promuoviAdminConfigurato();
    }
}
