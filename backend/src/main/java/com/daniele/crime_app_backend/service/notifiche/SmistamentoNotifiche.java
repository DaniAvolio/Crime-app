package com.daniele.crime_app_backend.service.notifiche;

import com.daniele.crime_app_backend.entity.Categoria;
import com.daniele.crime_app_backend.entity.DeviceToken;
import com.daniele.crime_app_backend.entity.Notifica;
import com.daniele.crime_app_backend.entity.PreferenzeNotifica;
import com.daniele.crime_app_backend.entity.Segnalazione;
import com.daniele.crime_app_backend.entity.TraduzioneCategoria;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.entity.enums.TipoNotifica;
import com.daniele.crime_app_backend.repository.DeviceTokenRepository;
import com.daniele.crime_app_backend.repository.NotificaRepository;
import com.daniele.crime_app_backend.repository.PreferenzeNotificaRepository;
import com.daniele.crime_app_backend.repository.SegnalazioneRepository;
import com.daniele.crime_app_backend.repository.UtenteRepository;
import com.daniele.crime_app_backend.service.push.WebPushClient;
import com.daniele.crime_app_backend.service.notifiche.EventiNotifica.SegnalazioneAggiornata;
import com.daniele.crime_app_backend.service.notifiche.EventiNotifica.SegnalazionePubblicata;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Trasforma gli eventi (EventiNotifica) in avvisi: salva una Notifica per ogni destinatario
 * (campanella) e decide se mandare anche la push a tutti i suoi dispositivi.
 * <p>
 * Regole della push: niente durante le ore di silenzio, salvo le gravi se l'utente lo consente;
 * al massimo {@code crimeapp.notifiche.push-per-ora} push vere all'ora per utente, oltre le
 * quali arriva un riepilogo con tag fisso che sostituisce il precedente invece di accumularsi.
 * <p>
 * Gira dopo il commit e su un thread separato; la parte sul database è in una transazione
 * propria, l'invio HTTP delle push fuori (non tiene connessioni al DB durante le chiamate).
 */
@Slf4j
@Service
public class SmistamentoNotifiche {

    static final ZoneId FUSO = ZoneId.of("Europe/Rome");
    private static final String TAG_RIEPILOGO = "crime-riepilogo";
    private static final String ICONA = "/assets/icons/icon-192.png";
    private static final String BADGE = "/assets/icons/badge-72.png";

    private final SegnalazioneRepository segnalazioneRepository;
    private final NotificaRepository notificaRepository;
    private final PreferenzeNotificaRepository preferenzeRepository;
    private final DeviceTokenRepository deviceTokenRepository;
    private final UtenteRepository utenteRepository;
    private final WebPushClient webPushClient;
    private final JsonMapper jsonMapper;
    private final TransactionTemplate transazione;
    private final int pushPerOra;

    public SmistamentoNotifiche(SegnalazioneRepository segnalazioneRepository,
                                NotificaRepository notificaRepository,
                                PreferenzeNotificaRepository preferenzeRepository,
                                DeviceTokenRepository deviceTokenRepository,
                                UtenteRepository utenteRepository,
                                WebPushClient webPushClient,
                                JsonMapper jsonMapper,
                                PlatformTransactionManager transactionManager,
                                @Value("${crimeapp.notifiche.push-per-ora:3}") int pushPerOra) {
        this.segnalazioneRepository = segnalazioneRepository;
        this.notificaRepository = notificaRepository;
        this.preferenzeRepository = preferenzeRepository;
        this.deviceTokenRepository = deviceTokenRepository;
        this.utenteRepository = utenteRepository;
        this.webPushClient = webPushClient;
        this.jsonMapper = jsonMapper;
        this.transazione = new TransactionTemplate(transactionManager);
        this.pushPerOra = pushPerOra;
    }

    /** Una push da mandare a un dispositivo, già composta. */
    record Invio(String endpoint, String p256dh, String auth, byte[] contenuto, boolean urgente) {}

    @Async
    @TransactionalEventListener(fallbackExecution = true)
    public void suPubblicata(SegnalazionePubblicata evento) {
        invia(transazione.execute(stato -> preparaVicina(evento.segnalazioneId(), LocalDateTime.now(FUSO))));
    }

    @Async
    @TransactionalEventListener(fallbackExecution = true)
    public void suAggiornata(SegnalazioneAggiornata evento) {
        invia(transazione.execute(stato ->
                preparaAggiornamento(evento.segnalazioneId(), evento.tipo(), LocalDateTime.now(FUSO))));
    }

    /** Nuova segnalazione: un avviso per ogni utente con una zona che la contiene. */
    List<Invio> preparaVicina(Long segnalazioneId, LocalDateTime adesso) {
        Segnalazione segnalazione = segnalazioneRepository.findById(segnalazioneId).orElse(null);
        if (segnalazione == null) {
            return List.of();
        }
        List<NotificaRepository.Destinatario> destinatari = notificaRepository.destinatariVicina(segnalazioneId);
        if (destinatari.isEmpty()) {
            return List.of();
        }
        List<Long> ids = destinatari.stream().map(NotificaRepository.Destinatario::getUtenteId).toList();
        Contesto contesto = contesto(ids, adesso);
        boolean grave = segnalazione.getCategoria().getGravita() == 3;
        List<Invio> invii = new ArrayList<>();
        for (NotificaRepository.Destinatario destinatario : destinatari) {
            invii.addAll(registra(destinatario.getUtenteId(), segnalazione, TipoNotifica.VICINA,
                    destinatario.getZonaNome(), grave, contesto, adesso));
        }
        log.info("Segnalazione {}: {} avvisi di prossimità, {} push", segnalazioneId, destinatari.size(), invii.size());
        return invii;
    }

    /** Novità su una segnalazione: avvisa l'autore, se vuole gli aggiornamenti sulle sue. */
    List<Invio> preparaAggiornamento(Long segnalazioneId, TipoNotifica tipo, LocalDateTime adesso) {
        Segnalazione segnalazione = segnalazioneRepository.findById(segnalazioneId).orElse(null);
        if (segnalazione == null || segnalazione.getAutore() == null || !segnalazione.getAutore().isAttivo()) {
            return List.of();
        }
        Long autoreId = segnalazione.getAutore().getId();
        Contesto contesto = contesto(List.of(autoreId), adesso);
        PreferenzeNotifica preferenze = contesto.preferenze(autoreId);
        if (!preferenze.isNotificheAttive() || !preferenze.isAggiornamentiMie()) {
            return List.of();
        }
        return registra(autoreId, segnalazione, tipo, null, false, contesto, adesso);
    }

    /** Preferenze, dispositivi e push dell'ultima ora dei destinatari: poche query per tutti. */
    private Contesto contesto(List<Long> utentiId, LocalDateTime adesso) {
        Map<Long, PreferenzeNotifica> preferenze = preferenzeRepository.findByUtenteIdIn(utentiId).stream()
                .collect(Collectors.toMap(p -> p.getUtente().getId(), Function.identity()));
        Map<Long, List<DeviceToken>> dispositivi = deviceTokenRepository.findByUtenteIdIn(utentiId).stream()
                .collect(Collectors.groupingBy(d -> d.getUtente().getId()));
        Map<Long, Long> pushRecenti = notificaRepository.contaPushDopo(utentiId, adesso.minusHours(1)).stream()
                .collect(Collectors.toMap(r -> (Long) r[0], r -> (Long) r[1]));
        return new Contesto(preferenze, dispositivi, pushRecenti);
    }

    private record Contesto(Map<Long, PreferenzeNotifica> perUtente, Map<Long, List<DeviceToken>> dispositivi,
                            Map<Long, Long> pushRecenti) {
        PreferenzeNotifica preferenze(Long utenteId) {
            return perUtente.getOrDefault(utenteId, PreferenzeNotifica.builder().build());
        }
    }

    private List<Invio> registra(Long utenteId, Segnalazione segnalazione, TipoNotifica tipo, String zona,
                                 boolean grave, Contesto contesto, LocalDateTime adesso) {
        Utente utente = utenteRepository.getReferenceById(utenteId);
        Notifica notifica = notificaRepository.save(Notifica.builder()
                .utente(utente).tipo(tipo).segnalazione(segnalazione).zonaNome(zona).build());

        List<DeviceToken> dispositivi = contesto.dispositivi().getOrDefault(utenteId, List.of());
        PreferenzeNotifica preferenze = contesto.preferenze(utenteId);
        if (dispositivi.isEmpty() || inSilenzio(adesso.toLocalTime(), preferenze.getOreSilenzioDa(),
                preferenze.getOreSilenzioA()) && !(grave && preferenze.isGraviInSilenzio())) {
            return List.of();
        }
        boolean sottoLimite = contesto.pushRecenti().getOrDefault(utenteId, 0L) < pushPerOra;
        long riepilogo = 0;
        if (sottoLimite) {
            notifica.setInviataPush(true);
            contesto.pushRecenti().merge(utenteId, 1L, Long::sum);
        } else {
            riepilogo = notificaRepository.contaVicineSenzaPushDopo(utenteId, adesso.minusHours(1));
        }

        List<Invio> invii = new ArrayList<>();
        for (DeviceToken dispositivo : dispositivi) {
            Map<String, Object> contenuto = sottoLimite
                    ? contenuto(notifica, segnalazione, dispositivo.getLingua())
                    : contenutoRiepilogo(riepilogo, dispositivo.getLingua());
            invii.add(new Invio(dispositivo.getToken(), dispositivo.getP256dh(), dispositivo.getAuth(),
                    jsonMapper.writeValueAsBytes(contenuto), sottoLimite && grave));
        }
        return invii;
    }

    /**
     * Formato del service worker di Angular (ngsw): "notification" con le opzioni della
     * Notification API; il clic apre l'app sulla pagina indicata in onActionClick.
     */
    private static Map<String, Object> contenuto(Notifica notifica, Segnalazione segnalazione, String lingua) {
        String linguaPush = MessaggiNotifica.linguaSupportata(lingua);
        MessaggiNotifica.Testo testo = MessaggiNotifica.per(notifica.getTipo(), linguaPush,
                nomeCategoria(segnalazione.getCategoria(), linguaPush), notifica.getZonaNome(),
                segnalazione.getDescrizione());
        String url = notifica.getTipo() == TipoNotifica.VICINA || notifica.getTipo() == TipoNotifica.CONFERMATA
                ? "/mappa?segnalazione=" + segnalazione.getId()
                : "/notifiche";
        return Map.of("notification", Map.of(
                "title", testo.titolo(),
                "body", testo.corpo(),
                "icon", ICONA,
                "badge", BADGE,
                "tag", "crime-" + segnalazione.getId() + "-" + notifica.getTipo().name().toLowerCase(),
                "data", Map.of(
                        "notificaId", notifica.getId(),
                        "onActionClick", Map.of("default",
                                Map.of("operation", "navigateLastFocusedOrOpen", "url", url)))));
    }

    private static Map<String, Object> contenutoRiepilogo(long numero, String lingua) {
        MessaggiNotifica.Testo testo = MessaggiNotifica.riepilogo(lingua, Math.max(1, numero));
        return Map.of("notification", Map.of(
                "title", testo.titolo(),
                "body", testo.corpo(),
                "icon", ICONA,
                "badge", BADGE,
                "tag", TAG_RIEPILOGO,
                "renotify", false,
                "data", Map.of("onActionClick", Map.of("default",
                        Map.of("operation", "navigateLastFocusedOrOpen", "url", "/notifiche")))));
    }

    private static String nomeCategoria(Categoria categoria, String lingua) {
        TraduzioneCategoria traduzione = categoria.getTraduzioni().get(lingua);
        return traduzione != null ? traduzione.getNome() : categoria.getNome();
    }

    /** Ore di silenzio [da, a), anche a cavallo della mezzanotte (es. 23:00–07:00). */
    static boolean inSilenzio(LocalTime ora, LocalTime da, LocalTime a) {
        if (da == null || a == null || da.equals(a)) {
            return false;
        }
        return da.isBefore(a)
                ? !ora.isBefore(da) && ora.isBefore(a)
                : !ora.isBefore(da) || ora.isBefore(a);
    }

    /** Invio fuori transazione; le sottoscrizioni revocate dal browser si cancellano. */
    private void invia(List<Invio> invii) {
        if (invii == null) {
            return;
        }
        for (Invio invio : invii) {
            WebPushClient.Esito esito = webPushClient.invia(invio.endpoint(), invio.p256dh(), invio.auth(),
                    invio.contenuto(), invio.urgente());
            if (esito == WebPushClient.Esito.SCADUTA) {
                transazione.executeWithoutResult(stato -> deviceTokenRepository.eliminaPerToken(invio.endpoint()));
                log.info("Sottoscrizione push scaduta, eliminata");
            }
        }
    }
}
