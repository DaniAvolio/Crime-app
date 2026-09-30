package com.daniele.crime_app_backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Job notturno che anonimizza le segnalazioni concluse da più di N mesi (vedi
 * AnonimizzazioneService). Lavora a blocchi, ognuno nella sua transazione: anche un arretrato
 * grande non tiene lock a lungo, e un errore a metà non annulla i blocchi già fatti.
 */
@Slf4j
@Component
public class SegnalazioneAnonimizzazioneJob {

    private final AnonimizzazioneService anonimizzazioneService;
    private final int mesi;
    private final int dimensioneBlocco;

    public SegnalazioneAnonimizzazioneJob(
            AnonimizzazioneService anonimizzazioneService,
            @Value("${crimeapp.segnalazioni.anonimizzazione.mesi:12}") int mesi,
            @Value("${crimeapp.segnalazioni.anonimizzazione.dimensione-blocco:1000}") int dimensioneBlocco) {
        this.anonimizzazioneService = anonimizzazioneService;
        this.mesi = mesi;
        this.dimensioneBlocco = dimensioneBlocco;
    }

    @Scheduled(cron = "${crimeapp.segnalazioni.anonimizzazione.cron:0 30 3 * * *}")
    public void anonimizzaStorico() {
        LocalDateTime soglia = LocalDateTime.now().minusMonths(mesi);
        int totale = 0;
        int blocco;
        do {
            blocco = anonimizzazioneService.anonimizzaBlocco(soglia, dimensioneBlocco);
            totale += blocco;
        } while (blocco == dimensioneBlocco);
        if (totale > 0) {
            log.info("Segnalazioni anonimizzate (chiuse da oltre {} mesi): {}", mesi, totale);
        }
    }
}
