package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.EsitoRevisioneRequest;
import com.daniele.crime_app_backend.dto.SegnalazioneAbusoDto;
import com.daniele.crime_app_backend.dto.SegnalazioneAbusoRequest;
import com.daniele.crime_app_backend.dto.SegnalazioneDto;
import com.daniele.crime_app_backend.entity.Segnalazione;
import com.daniele.crime_app_backend.entity.SegnalazioneAbuso;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;
import com.daniele.crime_app_backend.exception.AccessoNegatoException;
import com.daniele.crime_app_backend.exception.ConflittoException;
import com.daniele.crime_app_backend.mapper.SegnalazioneAbusoMapper;
import com.daniele.crime_app_backend.repository.SegnalazioneAbusoRepository;
import com.daniele.crime_app_backend.repository.SegnalazioneRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Objects;

@Slf4j
@Service
@Transactional(readOnly = true)
public class SegnalazioneAbusoService {

    /** Peso minimo di un abuso: anche chi ha poca fiducia viene ascoltato, ma conta poco. */
    static final BigDecimal PESO_MINIMO = new BigDecimal("0.25");

    private final SegnalazioneAbusoRepository segnalazioneAbusoRepository;
    private final SegnalazioneRepository segnalazioneRepository;
    private final SegnalazioneAbusoMapper segnalazioneAbusoMapper;
    private final SegnalazioneService segnalazioneService;
    private final UtenteCorrenteService utenteCorrenteService;
    private final BigDecimal sogliaPeso;

    public SegnalazioneAbusoService(SegnalazioneAbusoRepository segnalazioneAbusoRepository,
                                     SegnalazioneRepository segnalazioneRepository,
                                     SegnalazioneAbusoMapper segnalazioneAbusoMapper,
                                     SegnalazioneService segnalazioneService,
                                     UtenteCorrenteService utenteCorrenteService,
                                     @Value("${crimeapp.moderazione.soglia-peso-abusi:4.0}") BigDecimal sogliaPeso) {
        this.segnalazioneAbusoRepository = segnalazioneAbusoRepository;
        this.segnalazioneRepository = segnalazioneRepository;
        this.segnalazioneAbusoMapper = segnalazioneAbusoMapper;
        this.segnalazioneService = segnalazioneService;
        this.utenteCorrenteService = utenteCorrenteService;
        this.sogliaPeso = sogliaPeso;
    }

    /** Abusi di una segnalazione, dal più recente (solo ADMIN, vedi SecurityConfig). */
    public List<SegnalazioneAbusoDto> trovaPerSegnalazione(Long segnalazioneId) {
        return segnalazioneAbusoRepository.findBySegnalazioneIdOrderByDataSegnalazioneDesc(segnalazioneId).stream()
                .map(segnalazioneAbusoMapper::toDto)
                .toList();
    }

    /**
     * "Segnala un problema": un utente può segnalare abuso una sola volta per Segnalazione (vincolo
     * DB), non sulla propria e solo finché è ATTIVA. Ogni abuso pesa la fiducia del segnalante
     * (vedi peso); quando la somma dei pesi in attesa raggiunge la soglia, la Segnalazione viene
     * sospesa automaticamente. In ogni caso entra nella coda "da rivedere" dell'admin.
     */
    @Transactional
    public SegnalazioneAbusoDto segnala(Long segnalazioneId, SegnalazioneAbusoRequest request) {
        Segnalazione segnalazione = segnalazioneService.recuperaOLancia(segnalazioneId);
        Utente utente = utenteCorrenteService.utenteCorrente();

        if (segnalazione.getAutore() != null && Objects.equals(segnalazione.getAutore().getId(), utente.getId())) {
            throw new AccessoNegatoException("Non puoi segnalare un problema sulla tua segnalazione");
        }
        if (segnalazione.getStato() != StatoSegnalazione.ATTIVA) {
            throw new ConflittoException("Impossibile segnalare un problema su una segnalazione in stato "
                    + segnalazione.getStato());
        }
        if (segnalazioneAbusoRepository.existsBySegnalazioneIdAndUtenteId(segnalazioneId, utente.getId())) {
            throw new ConflittoException("Hai già segnalato un problema su questa segnalazione");
        }

        BigDecimal peso = peso(utente);
        String nota = request.nota() == null || request.nota().isBlank() ? null : request.nota().strip();
        SegnalazioneAbuso abuso = segnalazioneAbusoRepository.save(SegnalazioneAbuso.builder()
                .segnalazione(segnalazione)
                .utente(utente)
                .motivo(request.motivo())
                .nota(nota)
                .peso(peso)
                .build());

        segnalazioneRepository.registraAbuso(segnalazioneId, peso);
        BigDecimal totale = segnalazioneRepository.pesoAbusi(segnalazioneId);
        if (totale.compareTo(sogliaPeso) >= 0) {
            segnalazioneService.sospendiAutomaticamente(segnalazioneId,
                    "Soglia di segnalazioni di abuso raggiunta (peso " + totale + " su " + sogliaPeso + ")");
        }
        log.info("Abuso {} su segnalazione {} (peso {}, totale {})", request.motivo(), segnalazioneId, peso, totale);
        return segnalazioneAbusoMapper.toDto(abuso);
    }

    /** Decisione dell'admin sugli abusi in attesa, vedi SegnalazioneService.decidiRevisione. */
    @Transactional
    public SegnalazioneDto decidi(Long segnalazioneId, EsitoRevisioneRequest request) {
        return segnalazioneService.decidiRevisione(segnalazioneId, request);
    }

    /** Fiducia / 100, con un minimo di PESO_MINIMO: un utente nuovo (fiducia 100) pesa 1. */
    static BigDecimal peso(Utente utente) {
        int fiducia = utente.getPunteggioFiducia() == null ? 100 : utente.getPunteggioFiducia();
        BigDecimal peso = BigDecimal.valueOf(fiducia).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        return peso.max(PESO_MINIMO);
    }
}
