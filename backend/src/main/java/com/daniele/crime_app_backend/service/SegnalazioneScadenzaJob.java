package com.daniele.crime_app_backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Job periodico che porta in SCADUTA le segnalazioni ATTIVA la cui data di scadenza è passata. */
@Component
public class SegnalazioneScadenzaJob {

    private static final Logger log = LoggerFactory.getLogger(SegnalazioneScadenzaJob.class);

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
