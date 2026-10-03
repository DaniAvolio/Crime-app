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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SmistamentoNotificheTest {

    private static final LocalDateTime POMERIGGIO = LocalDateTime.of(2026, 10, 3, 15, 0);
    private static final LocalDateTime NOTTE = LocalDateTime.of(2026, 10, 3, 2, 0);

    @Mock
    private SegnalazioneRepository segnalazioneRepository;
    @Mock
    private NotificaRepository notificaRepository;
    @Mock
    private PreferenzeNotificaRepository preferenzeRepository;
    @Mock
    private DeviceTokenRepository deviceTokenRepository;
    @Mock
    private UtenteRepository utenteRepository;
    @Mock
    private WebPushClient webPushClient;
    @Mock
    private PlatformTransactionManager transactionManager;

    private final JsonMapper json = JsonMapper.builder().build();
    private final Utente utente = Utente.builder().id(2L).attivo(true).build();
    private Segnalazione segnalazione;
    private final List<Notifica> salvate = new ArrayList<>();

    @BeforeEach
    void prepara() {
        Categoria rissa = Categoria.builder().id(5L).nome("Rissa").gravita(3).build();
        rissa.getTraduzioni().put("en", new TraduzioneCategoria("Brawl", null));
        segnalazione = Segnalazione.builder().id(10L).categoria(rissa).descrizione("Lite in piazza").build();
        lenient().when(segnalazioneRepository.findById(10L)).thenReturn(Optional.of(segnalazione));
        lenient().when(utenteRepository.getReferenceById(2L)).thenReturn(utente);
        lenient().when(notificaRepository.save(any())).thenAnswer(i -> {
            Notifica n = i.getArgument(0);
            n.setId(100L + salvate.size());
            salvate.add(n);
            return n;
        });
        lenient().when(deviceTokenRepository.findByUtenteIdIn(anyCollection())).thenReturn(List.of(
                DeviceToken.builder().utente(utente).token("https://push.example/1").p256dh("k").auth("a").lingua("en").build()));
    }

    private SmistamentoNotifiche servizio() {
        return new SmistamentoNotifiche(segnalazioneRepository, notificaRepository, preferenzeRepository,
                deviceTokenRepository, utenteRepository, webPushClient, json, transactionManager, 3);
    }

    private void destinatario() {
        NotificaRepository.Destinatario d = new NotificaRepository.Destinatario() {
            public Long getUtenteId() { return 2L; }
            public String getZonaNome() { return "Casa"; }
        };
        when(notificaRepository.destinatariVicina(10L)).thenReturn(List.of(d));
    }

    private void preferenze(PreferenzeNotifica p) {
        p.setUtente(utente);
        when(preferenzeRepository.findByUtenteIdIn(anyCollection())).thenReturn(List.of(p));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> notifica(SmistamentoNotifiche.Invio invio) {
        return (Map<String, Object>) json.readValue(new String(invio.contenuto(), StandardCharsets.UTF_8), Map.class)
                .get("notification");
    }

    @Test
    void vicinaSottoIlLimiteMandaLaPushNellaLinguaDelDispositivo() {
        destinatario();
        when(notificaRepository.contaPushDopo(anyCollection(), any())).thenReturn(List.of());

        List<SmistamentoNotifiche.Invio> invii = servizio().preparaVicina(10L, POMERIGGIO);

        assertThat(salvate).singleElement().satisfies(n -> {
            assertThat(n.getTipo()).isEqualTo(TipoNotifica.VICINA);
            assertThat(n.getZonaNome()).isEqualTo("Casa");
            assertThat(n.isInviataPush()).isTrue();
        });
        assertThat(invii).singleElement().satisfies(i -> assertThat(i.urgente()).isTrue());
        Map<String, Object> notifica = notifica(invii.getFirst());
        assertThat(notifica.get("title")).isEqualTo("Brawl near Casa");
        assertThat(notifica.get("body")).isEqualTo("Lite in piazza");
        assertThat(notifica.toString()).contains("/mappa?segnalazione=10");
    }

    @Test
    void oltreIlLimiteOrarioArrivaIlRiepilogoCheSiAggiorna() {
        destinatario();
        when(notificaRepository.contaPushDopo(anyCollection(), any())).thenReturn(List.<Object[]>of(new Object[] {2L, 3L}));
        when(notificaRepository.contaVicineSenzaPushDopo(eq(2L), any())).thenReturn(4L);

        List<SmistamentoNotifiche.Invio> invii = servizio().preparaVicina(10L, POMERIGGIO);

        assertThat(salvate.getFirst().isInviataPush()).isFalse();
        Map<String, Object> notifica = notifica(invii.getFirst());
        assertThat(notifica.get("title")).isEqualTo("4 more reports in your areas");
        assertThat(notifica.get("tag")).isEqualTo("crime-riepilogo");
        assertThat(invii.getFirst().urgente()).isFalse();
    }

    @Test
    void inSilenzioSoloInAppSalvoLeGraviSeConsentito() {
        destinatario();
        PreferenzeNotifica p = PreferenzeNotifica.builder()
                .oreSilenzioDa(LocalTime.of(23, 0)).oreSilenzioA(LocalTime.of(7, 0)).graviInSilenzio(false).build();
        preferenze(p);
        lenient().when(notificaRepository.contaPushDopo(anyCollection(), any())).thenReturn(List.of());

        assertThat(servizio().preparaVicina(10L, NOTTE)).isEmpty();
        assertThat(salvate).hasSize(1);

        p.setGraviInSilenzio(true);
        assertThat(servizio().preparaVicina(10L, NOTTE)).hasSize(1);
    }

    @Test
    void aggiornamentoAllAutoreSoloSeLoVuole() {
        segnalazione.setAutore(utente);
        PreferenzeNotifica p = PreferenzeNotifica.builder().aggiornamentiMie(false).build();
        preferenze(p);
        lenient().when(notificaRepository.contaPushDopo(anyCollection(), any())).thenReturn(List.of());

        assertThat(servizio().preparaAggiornamento(10L, TipoNotifica.RIMOSSA, POMERIGGIO)).isEmpty();
        assertThat(salvate).isEmpty();

        p.setAggiornamentiMie(true);
        List<SmistamentoNotifiche.Invio> invii = servizio().preparaAggiornamento(10L, TipoNotifica.RIMOSSA, POMERIGGIO);
        assertThat(salvate).singleElement().satisfies(n -> assertThat(n.getTipo()).isEqualTo(TipoNotifica.RIMOSSA));
        assertThat(notifica(invii.getFirst()).get("title")).isEqualTo("Your report was removed");
        assertThat(notifica(invii.getFirst()).toString()).contains("/notifiche");
    }

    @Test
    void senzaDispositiviSoloLAvvisoInApp() {
        destinatario();
        when(deviceTokenRepository.findByUtenteIdIn(anyCollection())).thenReturn(List.of());
        when(notificaRepository.contaPushDopo(anyCollection(), any())).thenReturn(List.of());

        assertThat(servizio().preparaVicina(10L, POMERIGGIO)).isEmpty();
        ArgumentCaptor<Notifica> captor = ArgumentCaptor.forClass(Notifica.class);
        org.mockito.Mockito.verify(notificaRepository).save(captor.capture());
        assertThat(captor.getValue().isInviataPush()).isFalse();
    }

    @Test
    void oreDiSilenzioAncheACavalloDellaMezzanotte() {
        LocalTime da = LocalTime.of(23, 0);
        LocalTime a = LocalTime.of(7, 0);
        assertThat(SmistamentoNotifiche.inSilenzio(LocalTime.of(23, 30), da, a)).isTrue();
        assertThat(SmistamentoNotifiche.inSilenzio(LocalTime.of(3, 0), da, a)).isTrue();
        assertThat(SmistamentoNotifiche.inSilenzio(LocalTime.of(7, 0), da, a)).isFalse();
        assertThat(SmistamentoNotifiche.inSilenzio(LocalTime.of(12, 0), da, a)).isFalse();
        assertThat(SmistamentoNotifiche.inSilenzio(LocalTime.of(14, 0), LocalTime.of(13, 0), LocalTime.of(15, 0))).isTrue();
        assertThat(SmistamentoNotifiche.inSilenzio(LocalTime.of(14, 0), null, null)).isFalse();
    }
}
