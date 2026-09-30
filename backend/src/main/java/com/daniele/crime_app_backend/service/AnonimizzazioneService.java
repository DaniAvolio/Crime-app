package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.repository.ConfermaSegnalazioneRepository;
import com.daniele.crime_app_backend.repository.EventoModerazioneRepository;
import com.daniele.crime_app_backend.repository.SegnalazioneAbusoRepository;
import com.daniele.crime_app_backend.repository.SegnalazioneRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Anonimizzazione dello storico: le segnalazioni concluse da oltre N mesi perdono i dati
 * personali (autore, descrizione, voti, abusi, motivazioni di moderazione) e la posizione viene
 * arrotondata a ~100 m. Restano categoria, gravità, stato e date per le statistiche; i numeri
 * per utente restano nei contatori di Utente. Chiamato a blocchi da SegnalazioneAnonimizzazioneJob.
 */
@Service
public class AnonimizzazioneService {

    private final SegnalazioneRepository segnalazioneRepository;
    private final ConfermaSegnalazioneRepository confermaSegnalazioneRepository;
    private final SegnalazioneAbusoRepository segnalazioneAbusoRepository;
    private final EventoModerazioneRepository eventoModerazioneRepository;

    public AnonimizzazioneService(SegnalazioneRepository segnalazioneRepository,
                                  ConfermaSegnalazioneRepository confermaSegnalazioneRepository,
                                  SegnalazioneAbusoRepository segnalazioneAbusoRepository,
                                  EventoModerazioneRepository eventoModerazioneRepository) {
        this.segnalazioneRepository = segnalazioneRepository;
        this.confermaSegnalazioneRepository = confermaSegnalazioneRepository;
        this.segnalazioneAbusoRepository = segnalazioneAbusoRepository;
        this.eventoModerazioneRepository = eventoModerazioneRepository;
    }

    /**
     * Anonimizza fino a "dimensione" segnalazioni chiuse prima di "soglia", in una transazione
     * propria. Restituisce quante ne ha anonimizzate: 0 quando non ne restano.
     */
    @Transactional
    public int anonimizzaBlocco(LocalDateTime soglia, int dimensione) {
        List<Long> ids = segnalazioneRepository.trovaIdDaAnonimizzare(soglia, dimensione);
        if (ids.isEmpty()) {
            return 0;
        }
        confermaSegnalazioneRepository.eliminaPerSegnalazioni(ids);
        segnalazioneAbusoRepository.eliminaPerSegnalazioni(ids);
        eventoModerazioneRepository.cancellaMotivazioni(ids);
        return segnalazioneRepository.anonimizza(ids, LocalDateTime.now());
    }
}
