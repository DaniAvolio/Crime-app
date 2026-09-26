package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.SegnalazioneDto;
import com.daniele.crime_app_backend.dto.SegnalazioneRequest;
import com.daniele.crime_app_backend.dto.SegnalazioneTransizioneRequest;
import com.daniele.crime_app_backend.entity.Categoria;
import com.daniele.crime_app_backend.entity.EventoModerazione;
import com.daniele.crime_app_backend.entity.Segnalazione;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;
import com.daniele.crime_app_backend.entity.enums.TipoAttoreModerazione;
import com.daniele.crime_app_backend.exception.ConflittoException;
import com.daniele.crime_app_backend.exception.RisorsaNonTrovataException;
import com.daniele.crime_app_backend.mapper.SegnalazioneMapper;
import com.daniele.crime_app_backend.repository.EventoModerazioneRepository;
import com.daniele.crime_app_backend.repository.SegnalazioneRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@Transactional(readOnly = true)
public class SegnalazioneService {

    private final SegnalazioneRepository segnalazioneRepository;
    private final EventoModerazioneRepository eventoModerazioneRepository;
    private final SegnalazioneMapper segnalazioneMapper;
    private final UtenteService utenteService;
    private final CategoriaService categoriaService;

    public SegnalazioneService(SegnalazioneRepository segnalazioneRepository,
                                EventoModerazioneRepository eventoModerazioneRepository,
                                SegnalazioneMapper segnalazioneMapper,
                                UtenteService utenteService,
                                CategoriaService categoriaService) {
        this.segnalazioneRepository = segnalazioneRepository;
        this.eventoModerazioneRepository = eventoModerazioneRepository;
        this.segnalazioneMapper = segnalazioneMapper;
        this.utenteService = utenteService;
        this.categoriaService = categoriaService;
    }

    public List<SegnalazioneDto> trova(StatoSegnalazione stato, Long autoreId) {
        List<Segnalazione> risultati = segnalazioneRepository.findAll();
        if (stato != null) {
            risultati = risultati.stream().filter(s -> s.getStato() == stato).toList();
        }
        if (autoreId != null) {
            risultati = risultati.stream().filter(s -> s.getAutore().getId().equals(autoreId)).toList();
        }
        return risultati.stream().map(segnalazioneMapper::toDto).toList();
    }

    public SegnalazioneDto trovaPerId(Long id) {
        return segnalazioneMapper.toDto(recuperaOLancia(id));
    }

    /** Segnalazioni ATTIVA entro un raggio da un punto, per la vista mappa e le notifiche di prossimità. */
    public List<SegnalazioneDto> trovaVicine(double lat, double lng, double raggioMetri) {
        return segnalazioneRepository.trovaAttiveNelRaggio(lat, lng, raggioMetri).stream()
                .map(segnalazioneMapper::toDto)
                .toList();
    }

    /**
     * La data di scadenza è calcolata da Categoria.durataValiditaOre al momento
     * della creazione: la categoria può cambiare durata in seguito senza
     * alterare segnalazioni già create.
     */
    @Transactional
    public SegnalazioneDto crea(SegnalazioneRequest request) {
        Utente autore = utenteService.recuperaOLancia(request.autoreId());
        Categoria categoria = categoriaService.recuperaOLancia(request.categoriaId());

        Segnalazione segnalazione = Segnalazione.builder()
                .autore(autore)
                .categoria(categoria)
                .descrizione(request.descrizione())
                .posizione(segnalazioneMapper.creaPunto(request.lat(), request.lng()))
                .anonima(request.anonima())
                .stato(StatoSegnalazione.ATTIVA)
                .dataScadenza(LocalDateTime.now().plusHours(categoria.getDurataValiditaOre()))
                .build();
        return segnalazioneMapper.toDto(segnalazioneRepository.save(segnalazione));
    }

    /**
     * ATTIVA -> RIMOSSA (autore o admin) | SOSPESA -> RIMOSSA (solo admin).
     * L'attore è identificato per confronto con l'autore della segnalazione, non
     * essendo ancora presente un sistema di ruoli/autenticazione (vedi
     * SecurityConfig): chiunque non sia l'autore è trattato come admin.
     */
    @Transactional
    public SegnalazioneDto rimuovi(Long id, SegnalazioneTransizioneRequest request) {
        Segnalazione segnalazione = recuperaOLancia(id);
        Utente attore = utenteService.recuperaOLancia(request.attoreId());
        boolean isAutore = segnalazione.getAutore().getId().equals(attore.getId());

        if (segnalazione.getStato() != StatoSegnalazione.ATTIVA && segnalazione.getStato() != StatoSegnalazione.SOSPESA) {
            throw new ConflittoException("Impossibile rimuovere una segnalazione in stato " + segnalazione.getStato());
        }
        if (segnalazione.getStato() == StatoSegnalazione.SOSPESA && isAutore) {
            throw new ConflittoException("Solo un amministratore può rimuovere una segnalazione sospesa");
        }

        transiziona(segnalazione, StatoSegnalazione.RIMOSSA,
                isAutore ? TipoAttoreModerazione.AUTORE : TipoAttoreModerazione.ADMIN,
                isAutore ? null : attore, request.motivazione());
        segnalazione.setDataRimozione(LocalDateTime.now());
        return segnalazioneMapper.toDto(segnalazione);
    }

    /** SOSPESA -> ATTIVA, solo admin. */
    @Transactional
    public SegnalazioneDto riattiva(Long id, SegnalazioneTransizioneRequest request) {
        Segnalazione segnalazione = recuperaOLancia(id);
        Utente attore = utenteService.recuperaOLancia(request.attoreId());
        boolean isAutore = segnalazione.getAutore().getId().equals(attore.getId());

        if (segnalazione.getStato() != StatoSegnalazione.SOSPESA) {
            throw new ConflittoException("Impossibile riattivare una segnalazione in stato " + segnalazione.getStato());
        }
        if (isAutore) {
            throw new ConflittoException("Solo un amministratore può riattivare una segnalazione sospesa");
        }

        transiziona(segnalazione, StatoSegnalazione.ATTIVA, TipoAttoreModerazione.ADMIN, attore, request.motivazione());
        return segnalazioneMapper.toDto(segnalazione);
    }

    /** ATTIVA -> SOSPESA, automatico al superamento della soglia di abusi (vedi SegnalazioneAbusoService). */
    @Transactional
    void sospendiAutomaticamente(Long id, String motivazione) {
        Segnalazione segnalazione = recuperaOLancia(id);
        if (segnalazione.getStato() != StatoSegnalazione.ATTIVA) {
            return;
        }
        transiziona(segnalazione, StatoSegnalazione.SOSPESA, TipoAttoreModerazione.SISTEMA, null, motivazione);
    }

    /**
     * Conferma "ancora in atto" (vedi ConfermaSegnalazioneService): la scadenza
     * riparte da adesso con la durata della categoria, senza mai accorciarsi.
     */
    @Transactional
    void prolungaScadenza(Segnalazione segnalazione) {
        LocalDateTime adesso = LocalDateTime.now();
        LocalDateTime nuovaScadenza = adesso.plusHours(segnalazione.getCategoria().getDurataValiditaOre());
        if (nuovaScadenza.isAfter(segnalazione.getDataScadenza())) {
            segnalazione.setDataScadenza(nuovaScadenza);
        }
        segnalazione.setDataUltimaConferma(adesso);
        log.info("Segnalazione {} confermata ancora in atto, scadenza: {}", segnalazione.getId(),
                segnalazione.getDataScadenza());
    }

    /** ATTIVA -> SCADUTA, automatico al raggiungimento della soglia di voti "non più in atto". */
    @Transactional
    void scadiPerConfermeNegative(Segnalazione segnalazione, String motivazione) {
        transiziona(segnalazione, StatoSegnalazione.SCADUTA, TipoAttoreModerazione.SISTEMA, null, motivazione);
        log.info("Segnalazione {} scaduta: {}", segnalazione.getId(), motivazione);
    }

    /** ATTIVA -> SCADUTA per le segnalazioni la cui data di scadenza è passata. Pensato per un job schedulato. */
    @Transactional
    public int scadiSegnalazioniAttive() {
        List<Segnalazione> daScadere = segnalazioneRepository.findByStatoAndDataScadenzaBefore(
                StatoSegnalazione.ATTIVA, LocalDateTime.now());
        daScadere.forEach(s -> transiziona(s, StatoSegnalazione.SCADUTA, TipoAttoreModerazione.SISTEMA, null, null));
        return daScadere.size();
    }

    private void transiziona(Segnalazione segnalazione, StatoSegnalazione nuovoStato, TipoAttoreModerazione tipoAttore,
                              Utente amministratore, String motivazione) {
        StatoSegnalazione precedente = segnalazione.getStato();
        segnalazione.setStato(nuovoStato);
        eventoModerazioneRepository.save(EventoModerazione.builder()
                .segnalazione(segnalazione)
                .statoPrecedente(precedente)
                .statoNuovo(nuovoStato)
                .tipoAttore(tipoAttore)
                .amministratore(amministratore)
                .motivazione(motivazione)
                .build());
    }

    Segnalazione recuperaOLancia(Long id) {
        return segnalazioneRepository.findById(id)
                .orElseThrow(() -> new RisorsaNonTrovataException("Segnalazione non trovata con id: " + id));
    }
}
