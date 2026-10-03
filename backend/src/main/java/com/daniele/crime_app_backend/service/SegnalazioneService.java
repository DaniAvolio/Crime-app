package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.ConteggiMieSegnalazioniDto;
import com.daniele.crime_app_backend.dto.ConteggioCategoriaDto;
import com.daniele.crime_app_backend.dto.EsitoRevisioneRequest;
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
import com.daniele.crime_app_backend.entity.enums.EsitoAbuso;
import com.daniele.crime_app_backend.entity.enums.RuoloUtente;
import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;
import com.daniele.crime_app_backend.entity.enums.TipoAttoreModerazione;
import com.daniele.crime_app_backend.exception.AccessoNegatoException;
import com.daniele.crime_app_backend.exception.ConflittoException;
import com.daniele.crime_app_backend.exception.DescrizioneNonValidaException;
import com.daniele.crime_app_backend.exception.RichiestaNonValidaException;
import com.daniele.crime_app_backend.exception.RisorsaNonTrovataException;
import com.daniele.crime_app_backend.mapper.SegnalazioneMapper;
import com.daniele.crime_app_backend.repository.ConfermaSegnalazioneRepository;
import com.daniele.crime_app_backend.repository.EventoModerazioneRepository;
import com.daniele.crime_app_backend.repository.SegnalazioneAbusoRepository;
import com.daniele.crime_app_backend.repository.SegnalazioneRepository;
import com.daniele.crime_app_backend.repository.SpecificheGestione;
import com.daniele.crime_app_backend.repository.UtenteRepository;
import com.daniele.crime_app_backend.service.moderazione.TipoViolazione;
import com.daniele.crime_app_backend.service.moderazione.ValidatoreDescrizione;
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
import java.util.Set;
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
    private final ValidatoreDescrizione validatoreDescrizione;

    /** Fiducia: chi segnala abusi poi accolti guadagna poco, chi li fa respingere perde molto. */
    static final int FIDUCIA_ABUSO_FONDATO = 2;
    static final int FIDUCIA_ABUSO_INFONDATO = -10;
    /** Fiducia persa dall'autore quando un admin gli rimuove una segnalazione. */
    static final int FIDUCIA_AUTORE_RIMOSSA = -10;

    public SegnalazioneService(SegnalazioneRepository segnalazioneRepository,
                                EventoModerazioneRepository eventoModerazioneRepository,
                                ConfermaSegnalazioneRepository confermaSegnalazioneRepository,
                                SegnalazioneAbusoRepository segnalazioneAbusoRepository,
                                SegnalazioneMapper segnalazioneMapper,
                                CategoriaService categoriaService,
                                UtenteCorrenteService utenteCorrenteService,
                                UtenteRepository utenteRepository,
                                ValidatoreDescrizione validatoreDescrizione) {
        this.segnalazioneRepository = segnalazioneRepository;
        this.eventoModerazioneRepository = eventoModerazioneRepository;
        this.confermaSegnalazioneRepository = confermaSegnalazioneRepository;
        this.segnalazioneAbusoRepository = segnalazioneAbusoRepository;
        this.segnalazioneMapper = segnalazioneMapper;
        this.categoriaService = categoriaService;
        this.utenteCorrenteService = utenteCorrenteService;
        this.utenteRepository = utenteRepository;
        this.validatoreDescrizione = validatoreDescrizione;
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
            "dataScadenza", "dataScadenza",
            "numeroAbusi", "numeroAbusi",
            "pesoAbusi", "pesoAbusi");

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
        return toDto(segnalazione, relazioniUtenteCorrente(List.of(segnalazione)));
    }

    /**
     * Cosa ha già fatto l'utente autenticato sulle segnalazioni date: voti ("è ancora in atto?")
     * e problemi segnalati. Due query per tutta la vista; nessuna per gli ospiti.
     */
    private RelazioniUtente relazioniUtenteCorrente(List<Segnalazione> segnalazioni) {
        Optional<Long> utenteId = utenteCorrenteService.idCorrenteOpzionale();
        if (utenteId.isEmpty() || segnalazioni.isEmpty()) {
            return new RelazioniUtente(Map.of(), Set.of(), false);
        }
        List<Long> ids = segnalazioni.stream().map(Segnalazione::getId).toList();
        Map<Long, Boolean> voti = confermaSegnalazioneRepository
                .findByUtenteIdAndSegnalazioneIdIn(utenteId.get(), ids).stream()
                .collect(Collectors.toMap(c -> c.getSegnalazione().getId(), ConfermaSegnalazione::isAncoraInAtto));
        Set<Long> abusi = Set.copyOf(segnalazioneAbusoRepository.segnalazioniConAbusoDi(utenteId.get(), ids));
        return new RelazioniUtente(voti, abusi, true);
    }

    private record RelazioniUtente(Map<Long, Boolean> voti, Set<Long> abusi, boolean autenticato) {
        Boolean mioAbuso(Long id) {
            return autenticato ? abusi.contains(id) : null;
        }
    }

    /** DTO con voto e abuso dell'utente corrente. */
    private SegnalazioneDto toDto(Segnalazione s, RelazioniUtente relazioni) {
        return segnalazioneMapper.toDto(s, relazioni.voti().get(s.getId()), relazioni.mioAbuso(s.getId()));
    }

    /**
     * Tetto di sicurezza per /vicine: in una zona densa la mappa non riceve migliaia di marker.
     * Oltre il tetto restano le più gravi e, a parità, le più recenti.
     */
    static final int LIMITE_VICINE = 500;

    /** Segnalazioni ATTIVA entro un raggio da un punto, per la vista mappa e le notifiche di prossimità. */
    public List<SegnalazioneDto> trovaVicine(double lat, double lng, double raggioMetri) {
        List<Segnalazione> vicine = segnalazioneRepository.trovaAttiveNelRaggio(lat, lng, raggioMetri, LIMITE_VICINE);
        RelazioniUtente relazioni = relazioniUtenteCorrente(vicine);
        return vicine.stream().map(s -> toDto(s, relazioni)).toList();
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
        RelazioniUtente relazioni = relazioniUtenteCorrente(risultato.getContent());
        return PaginaDto.da(risultato, s -> toDto(s, relazioni));
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
        // Controlli bloccanti: 400 con le violazioni. Quelli soft mettono la segnalazione in coda.
        ValidatoreDescrizione.Esito esito = validatoreDescrizione.valida(request.descrizione());
        if (!esito.pubblicabile()) {
            throw new DescrizioneNonValidaException(esito.bloccanti());
        }
        Utente autore = utenteCorrenteService.utenteCorrente();
        Categoria categoria = categoriaService.recuperaOLancia(request.categoriaId());

        Segnalazione segnalazione = Segnalazione.builder()
                .autore(autore)
                .categoria(categoria)
                .descrizione(request.descrizione().strip())
                .posizione(segnalazioneMapper.creaPunto(request.lat(), request.lng()))
                .anonima(request.anonima())
                .stato(StatoSegnalazione.ATTIVA)
                .dataScadenza(LocalDateTime.now().plusHours(categoria.getDurataValiditaOre()))
                .daRivedere(!esito.soft().isEmpty())
                .revisioneAutomatica(esito.soft().isEmpty() ? null : esito.soft().stream()
                        .map(TipoViolazione::name).collect(Collectors.joining(",")))
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

        if (isAdmin) {
            rimuoviDaAdmin(segnalazione, attore, !isAutore, request.motivazione());
        } else {
            transiziona(segnalazione, StatoSegnalazione.RIMOSSA, TipoAttoreModerazione.AUTORE, null,
                    request.motivazione());
            segnalazione.setDataRimozione(LocalDateTime.now());
            // Ritirata dall'autore: non serve più rivederla, e gli abusi restano senza esito.
            segnalazioneRepository.chiudiRevisione(segnalazione.getId());
            azzeraRevisioneInMemoria(segnalazione);
        }
        return segnalazioneMapper.toDto(segnalazione);
    }

    /**
     * Rimozione da parte di un admin: gli abusi in attesa sono FONDATI. Conta come "rimossa" per
     * l'autore e gli costa fiducia, salvo che l'admin stia ritirando una propria segnalazione.
     */
    private void rimuoviDaAdmin(Segnalazione segnalazione, Utente admin, boolean penalizzaAutore,
                                String motivazione) {
        transiziona(segnalazione, StatoSegnalazione.RIMOSSA, TipoAttoreModerazione.ADMIN, admin, motivazione);
        segnalazione.setDataRimozione(LocalDateTime.now());
        chiudiRevisione(segnalazione, EsitoAbuso.FONDATO);
        if (penalizzaAutore && segnalazione.getAutore() != null) {
            utenteRepository.incrementaSegnalazioniRimosse(segnalazione.getAutore().getId());
            utenteRepository.modificaFiducia(List.of(segnalazione.getAutore().getId()), FIDUCIA_AUTORE_RIMOSSA);
        }
    }

    /**
     * Decisione dell'admin su una segnalazione in coda "da rivedere" (solo ADMIN, vedi SecurityConfig).
     * FONDATO: se è ancora ATTIVA o SOSPESA viene rimossa (come "Rimuovi"); se è già conclusa resta
     * com'è ma l'autore perde comunque fiducia. INFONDATO: se era SOSPESA torna ATTIVA. In entrambi i
     * casi gli abusi in attesa ricevono l'esito, la fiducia dei segnalanti cambia e la segnalazione
     * esce dalla coda.
     */
    @Transactional
    public SegnalazioneDto decidiRevisione(Long id, EsitoRevisioneRequest request) {
        Segnalazione segnalazione = recuperaOLancia(id);
        Utente admin = utenteCorrenteService.utenteCorrente();
        if (admin.getRuolo() != RuoloUtente.ADMIN) {
            throw new AccessoNegatoException("Solo un amministratore può decidere sulle segnalazioni di abuso");
        }
        if (!segnalazione.isDaRivedere()) {
            throw new ConflittoException("La segnalazione " + id + " non è in attesa di revisione");
        }
        boolean propria = segnalazione.getAutore() != null
                && Objects.equals(segnalazione.getAutore().getId(), admin.getId());
        boolean inCorso = segnalazione.getStato() == StatoSegnalazione.ATTIVA
                || segnalazione.getStato() == StatoSegnalazione.SOSPESA;

        if (request.esito() == EsitoAbuso.FONDATO) {
            if (inCorso) {
                rimuoviDaAdmin(segnalazione, admin, !propria, motivazioneOppure(request,
                        "Segnalazioni di abuso accolte"));
            } else {
                chiudiRevisione(segnalazione, EsitoAbuso.FONDATO);
                if (!propria && segnalazione.getAutore() != null) {
                    utenteRepository.modificaFiducia(List.of(segnalazione.getAutore().getId()),
                            FIDUCIA_AUTORE_RIMOSSA);
                }
            }
        } else {
            if (segnalazione.getStato() == StatoSegnalazione.SOSPESA) {
                transiziona(segnalazione, StatoSegnalazione.ATTIVA, TipoAttoreModerazione.ADMIN, admin,
                        motivazioneOppure(request, "Segnalazioni di abuso respinte"));
            }
            chiudiRevisione(segnalazione, EsitoAbuso.INFONDATO);
        }
        log.info("Revisione segnalazione {}: abusi {}", id, request.esito());
        return segnalazioneMapper.toDto(segnalazione);
    }

    private static String motivazioneOppure(EsitoRevisioneRequest request, String predefinita) {
        return request.motivazione() == null || request.motivazione().isBlank()
                ? predefinita : request.motivazione().strip();
    }

    /**
     * Esito agli abusi in attesa, fiducia dei segnalanti aggiornata e segnalazione fuori dalla coda.
     * Anche senza abusi (solo controlli automatici) la segnalazione esce dalla coda.
     */
    private void chiudiRevisione(Segnalazione segnalazione, EsitoAbuso esito) {
        List<Long> segnalanti = segnalazioneAbusoRepository.segnalantiInAttesa(segnalazione.getId());
        if (!segnalanti.isEmpty()) {
            segnalazioneAbusoRepository.registraEsito(segnalazione.getId(), esito);
            utenteRepository.modificaFiducia(segnalanti,
                    esito == EsitoAbuso.FONDATO ? FIDUCIA_ABUSO_FONDATO : FIDUCIA_ABUSO_INFONDATO);
        }
        segnalazioneRepository.chiudiRevisione(segnalazione.getId());
        azzeraRevisioneInMemoria(segnalazione);
    }

    /** Le colonne della coda non si scrivono dall'entità: si allinea la copia in memoria per il DTO. */
    private static void azzeraRevisioneInMemoria(Segnalazione segnalazione) {
        segnalazione.setNumeroAbusi(0);
        segnalazione.setPesoAbusi(java.math.BigDecimal.ZERO);
        segnalazione.setDaRivedere(false);
    }

    /** Quante segnalazioni sono in coda per l'admin (contatore in testa alla gestione). */
    public long contaDaRivedere() {
        return segnalazioneRepository.countByDaRivedereTrue();
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
        // Riattivarla vuol dire che gli abusi che l'hanno sospesa non erano fondati.
        chiudiRevisione(segnalazione, EsitoAbuso.INFONDATO);
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
