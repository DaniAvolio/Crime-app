package com.daniele.crime_app_backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Job periodico che porta in SCADUTA le segnalazioni ATTIVA la cui data di scadenza è passata. */
@Slf4j
@Component
public class SegnalazioneScadenzaJob {

    private final SegnalazioneService segnalazioneService;

    public SegnalazioneScadenzaJob(SegnalazioneService segnalazioneService) {
        this.segnalazioneService = segnalazioneService;
    }

    @Scheduled(fixedRateString = "${crimeapp.segnalazioni.scadenza-job-rate-ms:300000}")
    public void scadiSegnalazioni() {
        int scadute = segnalazioneService.scadiSegnalazioniAttive();
        if (scadute > 0) {
            log.info("Segnalazioni scadute automaticamente: {}", scadute);
        }
    }
}
