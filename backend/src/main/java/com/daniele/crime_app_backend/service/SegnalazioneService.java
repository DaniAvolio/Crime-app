package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.ConteggiMieSegnalazioniDto;
import com.daniele.crime_app_backend.dto.ConteggioCategoriaDto;
import com.daniele.crime_app_backend.dto.FiltriSegnalazioni;
import com.daniele.crime_app_backend.dto.GruppoSegnalazioniMie;
import com.daniele.crime_app_backend.dto.PaginaDto;
import com.daniele.crime_app_backend.dto.SegnalazioneDto;
import com.daniele.crime_app_backend.dto.SegnalazioneRequest;
import com.daniele.crime_app_backend.dto.SegnalazioneTransizioneRequest;
import com.daniele.crime_app_backend.entity.Categoria;
import com.daniele.crime_app_backend.entity.ConfermaSegnalazione;
import com.daniele.crime_app_backend.entity.EventoModerazione;
import com.daniele.crime_app_backend.entity.Segnalazione;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.entity.enums.RuoloUtente;
import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;
import com.daniele.crime_app_backend.entity.enums.TipoAttoreModerazione;
import com.daniele.crime_app_backend.exception.AccessoNegatoException;
import com.daniele.crime_app_backend.exception.ConflittoException;
import com.daniele.crime_app_backend.exception.RichiestaNonValidaException;
import com.daniele.crime_app_backend.exception.RisorsaNonTrovataException;
import com.daniele.crime_app_backend.mapper.SegnalazioneMapper;
import com.daniele.crime_app_backend.repository.ConfermaSegnalazioneRepository;
import com.daniele.crime_app_backend.repository.EventoModerazioneRepository;
import com.daniele.crime_app_backend.repository.SegnalazioneAbusoRepository;
import com.daniele.crime_app_backend.repository.SegnalazioneRepository;
import com.daniele.crime_app_backend.repository.SpecificheGestione;
import com.daniele.crime_app_backend.repository.UtenteRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@Transactional(readOnly = true)
public class SegnalazioneService {

    private final SegnalazioneRepository segnalazioneRepository;
    private final EventoModerazioneRepository eventoModerazioneRepository;
    private final ConfermaSegnalazioneRepository confermaSegnalazioneRepository;
    private final SegnalazioneAbusoRepository segnalazioneAbusoRepository;
    private final SegnalazioneMapper segnalazioneMapper;
    private final CategoriaService categoriaService;
    private final UtenteCorrenteService utenteCorrenteService;
    private final UtenteRepository utenteRepository;

    public SegnalazioneService(SegnalazioneRepository segnalazioneRepository,
                                EventoModerazioneRepository eventoModerazioneRepository,
                                ConfermaSegnalazioneRepository confermaSegnalazioneRepository,
                                SegnalazioneAbusoRepository segnalazioneAbusoRepository,
                                SegnalazioneMapper segnalazioneMapper,
                                CategoriaService categoriaService,
                                UtenteCorrenteService utenteCorrenteService,
                                UtenteRepository utenteRepository) {
        this.segnalazioneRepository = segnalazioneRepository;
        this.eventoModerazioneRepository = eventoModerazioneRepository;
        this.confermaSegnalazioneRepository = confermaSegnalazioneRepository;
        this.segnalazioneAbusoRepository = segnalazioneAbusoRepository;
        this.segnalazioneMapper = segnalazioneMapper;
        this.categoriaService = categoriaService;
        this.utenteCorrenteService = utenteCorrenteService;
        this.utenteRepository = utenteRepository;
    }

    /**
     * Con mie=true filtra sulle segnalazioni dell'utente autenticato. Filtrando
     * per autoreId altrui le segnalazioni anonime vengono escluse (salvo per gli
     * admin), altrimenti il filtro stesso rivelerebbe chi le ha scritte.
     */
    public List<SegnalazioneDto> trova(StatoSegnalazione stato, Long autoreId, boolean mie) {
        Long autoreFiltro = mie ? utenteCorrenteService.idCorrente() : autoreId;
        List<Segnalazione> risultati = segnalazioneRepository.findAll();
        if (stato != null) {
            risultati = risultati.stream().filter(s -> s.getStato() == stato).toList();
        }
        if (autoreFiltro != null) {
            boolean includiAnonime = utenteCorrenteService.isAdmin()
                    || utenteCorrenteService.idCorrenteOpzionale().map(autoreFiltro::equals).orElse(false);
            risultati = risultati.stream()
                    .filter(s -> s.getAutore() != null && autoreFiltro.equals(s.getAutore().getId()))
                    .filter(s -> includiAnonime || !s.isAnonima())
                    .toList();
        }
        return risultati.stream().map(segnalazioneMapper::toDto).toList();
    }

    /** Colonne ordinabili della tabella in gestione: nome esposto al client -> proprietà JPA. */
    private static final Map<String, String> ORDINABILI_GESTIONE = Map.of(
            "id", "id",
            "categoria", "categoria.nome",
            "descrizione", "descrizione",
            "anonima", "anonima",
            "stato", "stato",
            "dataCreazione", "dataCreazione",
            "dataScadenza", "dataScadenza");

    /** Tabella di gestione (solo admin): filtri per colonna, ordinamento e paginazione lato database. */
    public PaginaDto<SegnalazioneDto> trovaPerGestione(FiltriSegnalazioni filtri, int pagina, int dimensione,
                                                       String ordina) {
        Pageable richiesta = Paginazione.crea(pagina, dimensione, ordina, ORDINABILI_GESTIONE,
                Sort.by(Sort.Order.desc("dataCreazione")));
        return PaginaDto.da(segnalazioneRepository.findAll(SpecificheGestione.segnalazioni(filtri), richiesta),
                segnalazioneMapper::toDto);
    }

    /**
     * Profilo: le segnalazioni dell'utente corrente, una scheda alla volta e a pagine, dalla più
     * recente. Include le proprie anonime (l'autore le vede sempre).
     */
    public PaginaDto<SegnalazioneDto> trovaMie(GruppoSegnalazioniMie gruppo, int pagina, int dimensione) {
        Long autoreId = utenteCorrenteService.idCorrente();
        Pageable richiesta = Paginazione.crea(pagina, dimensione, null, Map.of(),
                Sort.by(Sort.Order.desc("dataCreazione")));
        Specification<Segnalazione> filtro = (root, query, cb) -> cb.and(
                cb.equal(root.get("autore").get("id"), autoreId),
                gruppo == GruppoSegnalazioniMie.ATTIVE
                        ? cb.equal(root.get("stato"), StatoSegnalazione.ATTIVA)
                        : cb.notEqual(root.get("stato"), StatoSegnalazione.ATTIVA));
        return PaginaDto.da(segnalazioneRepository.findAll(filtro, richiesta), segnalazioneMapper::toDto);
    }

    /** Contatori delle schede del profilo, senza caricare le segnalazioni. */
    public ConteggiMieSegnalazioniDto conteggiMie() {
        Long autoreId = utenteCorrenteService.idCorrente();
        long attive = segnalazioneRepository.countByAutoreIdAndStato(autoreId, StatoSegnalazione.ATTIVA);
        return new ConteggiMieSegnalazioniDto(attive, segnalazioneRepository.countByAutoreId(autoreId) - attive);
    }

    public SegnalazioneDto trovaPerId(Long id) {
        Segnalazione segnalazione = recuperaOLancia(id);
        return segnalazioneMapper.toDto(segnalazione, votiUtenteCorrente(List.of(segnalazione)).get(id));
    }

    /** Risposte dell'utente autenticato alle segnalazioni date (vuoto per gli ospiti, senza query). */
    private Map<Long, Boolean> votiUtenteCorrente(List<Segnalazione> segnalazioni) {
        Optional<Long> utenteId = utenteCorrenteService.idCorrenteOpzionale();
        if (utenteId.isEmpty() || segnalazioni.isEmpty()) {
            return Map.of();
        }
        List<Long> ids = segnalazioni.stream().map(Segnalazione::getId).toList();
        return confermaSegnalazioneRepository.findByUtenteIdAndSegnalazioneIdIn(utenteId.get(), ids).stream()
                .collect(Collectors.toMap(c -> c.getSegnalazione().getId(), ConfermaSegnalazione::isAncoraInAtto));
    }

    /**
     * Tetto di sicurezza per /vicine: in una zona densa la mappa non riceve migliaia di marker.
     * Oltre il tetto restano le più gravi e, a parità, le più recenti.
     */
    static final int LIMITE_VICINE = 500;

    /** Segnalazioni ATTIVA entro un raggio da un punto, per la vista mappa e le notifiche di prossimità. */
    public List<SegnalazioneDto> trovaVicine(double lat, double lng, double raggioMetri) {
        List<Segnalazione> vicine = segnalazioneRepository.trovaAttiveNelRaggio(lat, lng, raggioMetri, LIMITE_VICINE);
        Map<Long, Boolean> voti = votiUtenteCorrente(vicine);
        return vicine.stream()
                .map(s -> segnalazioneMapper.toDto(s, voti.get(s.getId())))
                .toList();
    }

    /** Raggio massimo della vista lista (i raggi selezionabili arrivano a 10 km). */
    static final double RAGGIO_MASSIMO_LISTA_METRI = 20_000;

    /**
     * Vista lista: una pagina di segnalazioni ATTIVA nel raggio, dalla più vicina, con filtri
     * opzionali per gravità e categoria e il voto dell'utente corrente come per la mappa.
     */
    public PaginaDto<SegnalazioneDto> trovaVicinePerDistanza(double lat, double lng, double raggioMetri,
                                                             Integer gravita, Long categoriaId,
                                                             int pagina, int dimensione) {
        validaRaggioLista(raggioMetri);
        var risultato = segnalazioneRepository.trovaAttiveNelRaggioPerDistanza(lat, lng, raggioMetri, gravita,
                categoriaId, Paginazione.senzaOrdinamento(pagina, dimensione));
        Map<Long, Boolean> voti = votiUtenteCorrente(risultato.getContent());
        return PaginaDto.da(risultato, s -> segnalazioneMapper.toDto(s, voti.get(s.getId())));
    }

    /** Vista lista: quante segnalazioni ATTIVA ci sono nel raggio per ogni categoria. */
    public List<ConteggioCategoriaDto> conteggiVicinePerCategoria(double lat, double lng, double raggioMetri,
                                                                  Integer gravita) {
        validaRaggioLista(raggioMetri);
        return segnalazioneRepository.contaAttiveNelRaggioPerCategoria(lat, lng, raggioMetri, gravita).stream()
                .map(c -> new ConteggioCategoriaDto(c.getCategoriaId(), c.getNumero()))
                .toList();
    }

    private static void validaRaggioLista(double raggioMetri) {
        if (raggioMetri <= 0 || raggioMetri > RAGGIO_MASSIMO_LISTA_METRI) {
            throw new RichiestaNonValidaException("Raggio fuori dall'intervallo consentito: " + raggioMetri);
        }
    }

    /**
     * La data di scadenza è calcolata da Categoria.durataValiditaOre al momento
     * della creazione: la categoria può cambiare durata in seguito senza
     * alterare segnalazioni già create.
     */
    @Transactional
    public SegnalazioneDto crea(SegnalazioneRequest request) {
        Utente autore = utenteCorrenteService.utenteCorrente();
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
        Segnalazione salvata = segnalazioneRepository.save(segnalazione);
        utenteRepository.incrementaSegnalazioniFatte(autore.getId());
        return segnalazioneMapper.toDto(salvata);
    }

    /**
     * ATTIVA -> RIMOSSA (autore o admin) | SOSPESA -> RIMOSSA (solo admin).
     * L'attore è l'utente autenticato: il ruolo ADMIN prevale sull'essere
     * autore, così un admin che rimuove una propria segnalazione sospesa può farlo.
     */
    @Transactional
    public SegnalazioneDto rimuovi(Long id, SegnalazioneTransizioneRequest request) {
        Segnalazione segnalazione = recuperaOLancia(id);
        Utente attore = utenteCorrenteService.utenteCorrente();
        boolean isAdmin = attore.getRuolo() == RuoloUtente.ADMIN;
        boolean isAutore = segnalazione.getAutore() != null
                && Objects.equals(segnalazione.getAutore().getId(), attore.getId());

        if (!isAdmin && !isAutore) {
            throw new AccessoNegatoException("Solo l'autore o un amministratore può rimuovere questa segnalazione");
        }
        if (segnalazione.getStato() != StatoSegnalazione.ATTIVA && segnalazione.getStato() != StatoSegnalazione.SOSPESA) {
            throw new ConflittoException("Impossibile rimuovere una segnalazione in stato " + segnalazione.getStato());
        }
        if (segnalazione.getStato() == StatoSegnalazione.SOSPESA && !isAdmin) {
            throw new AccessoNegatoException("Solo un amministratore può rimuovere una segnalazione sospesa");
        }

        transiziona(segnalazione, StatoSegnalazione.RIMOSSA,
                isAdmin ? TipoAttoreModerazione.ADMIN : TipoAttoreModerazione.AUTORE,
                isAdmin ? attore : null, request.motivazione());
        segnalazione.setDataRimozione(LocalDateTime.now());
        // Conta come "rimossa" per l'autore solo se la toglie un admin (non se la ritira lui).
        if (isAdmin && !isAutore && segnalazione.getAutore() != null) {
            utenteRepository.incrementaSegnalazioniRimosse(segnalazione.getAutore().getId());
        }
        return segnalazioneMapper.toDto(segnalazione);
    }

    /** SOSPESA -> ATTIVA, solo admin (verificato anche in SecurityConfig). */
    @Transactional
    public SegnalazioneDto riattiva(Long id, SegnalazioneTransizioneRequest request) {
        Segnalazione segnalazione = recuperaOLancia(id);
        Utente attore = utenteCorrenteService.utenteCorrente();

        if (attore.getRuolo() != RuoloUtente.ADMIN) {
            throw new AccessoNegatoException("Solo un amministratore può riattivare una segnalazione sospesa");
        }
        if (segnalazione.getStato() != StatoSegnalazione.SOSPESA) {
            throw new ConflittoException("Impossibile riattivare una segnalazione in stato " + segnalazione.getStato());
        }

        transiziona(segnalazione, StatoSegnalazione.ATTIVA, TipoAttoreModerazione.ADMIN, attore, request.motivazione());
        return segnalazioneMapper.toDto(segnalazione);
    }

    /**
     * Cancellazione fisica dal DB (solo ADMIN, vedi SecurityConfig), a differenza di rimuovi()
     * che cambia solo lo stato. Serve ad esempio per poter poi eliminare una categoria, che il
     * vincolo di FK blocca finché ha segnalazioni. Le tabelle collegate non hanno ON DELETE
     * CASCADE: voti, abusi ed eventi di moderazione vanno cancellati prima, nella stessa transazione.
     */
    @Transactional
    public void eliminaDefinitivamente(Long id) {
        Segnalazione segnalazione = recuperaOLancia(id);
        confermaSegnalazioneRepository.eliminaPerSegnalazione(id);
        segnalazioneAbusoRepository.eliminaPerSegnalazione(id);
        eventoModerazioneRepository.eliminaPerSegnalazione(id);
        segnalazioneRepository.delete(segnalazione);
        log.info("Eliminazione definitiva segnalazione: id={}", id);
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

    /**
     * ATTIVA -> SCADUTA quando l'autore stesso risponde che non è più in atto: la fonte vale più
     * della soglia di voti. SCADUTA (conclusa), non RIMOSSA (ritirata o moderata).
     */
    @Transactional
    void concludiDaAutore(Segnalazione segnalazione) {
        transiziona(segnalazione, StatoSegnalazione.SCADUTA, TipoAttoreModerazione.AUTORE, null,
                "Conclusa dall'autore: non più in atto");
        log.info("Segnalazione {} conclusa dall'autore", segnalazione.getId());
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
