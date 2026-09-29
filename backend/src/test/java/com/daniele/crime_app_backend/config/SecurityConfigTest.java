package com.daniele.crime_app_backend.config;

import com.daniele.crime_app_backend.controller.AuthController;
import com.daniele.crime_app_backend.controller.CategoriaController;
import com.daniele.crime_app_backend.controller.SegnalazioneController;
import com.daniele.crime_app_backend.controller.UtenteController;
import com.daniele.crime_app_backend.dto.FiltriCategorie;
import com.daniele.crime_app_backend.dto.FiltriSegnalazioni;
import com.daniele.crime_app_backend.dto.FiltriUtenti;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;
import com.daniele.crime_app_backend.entity.enums.RuoloUtente;
import com.daniele.crime_app_backend.repository.UtenteRepository;
import com.daniele.crime_app_backend.service.AuthService;
import com.daniele.crime_app_backend.service.CategoriaService;
import com.daniele.crime_app_backend.service.SegnalazioneService;
import com.daniele.crime_app_backend.service.UtenteCorrenteService;
import com.daniele.crime_app_backend.service.UtenteService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.LocalDate;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Verifica le regole di accesso di SecurityConfig: i service sono mock, conta solo lo status HTTP. */
@WebMvcTest(controllers = {SegnalazioneController.class, CategoriaController.class, AuthController.class,
        UtenteController.class})
@Import({SecurityConfig.class, ErroriSicurezzaHandler.class, JwtUtenteConverter.class})
class SecurityConfigTest {

    private static final String CATEGORIA_VALIDA = """
            {"nome": "Furto", "durataValiditaOre": 24, "gravita": 2}
            """;
    private static final String SEGNALAZIONE_VALIDA = """
            {"categoriaId": 1, "descrizione": "Auto in sosta vietata", "lat": 45, "lng": 9, "anonima": false}
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SegnalazioneService segnalazioneService;
    @MockitoBean
    private CategoriaService categoriaService;
    @MockitoBean
    private AuthService authService;
    @MockitoBean
    private UtenteService utenteService;
    @MockitoBean
    private UtenteCorrenteService utenteCorrenteService;
    /** Richiesto da JwtUtenteConverter; il post-processor jwt() di questi test non passa dal converter. */
    @MockitoBean
    private UtenteRepository utenteRepository;

    @Test
    void consultazioneSegnalazioniECategorieEPubblica() throws Exception {
        mockMvc.perform(get("/api/segnalazioni/vicine").param("lat", "45").param("lng", "9").param("raggioMetri", "1000"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/categorie")).andExpect(status().isOk());
    }

    @Test
    void loginEPubblico() throws Exception {
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"a@b.it\", \"password\": \"x\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void creareUnaSegnalazioneSenzaTokenRestituisce401() throws Exception {
        mockMvc.perform(post("/api/segnalazioni").contentType(MediaType.APPLICATION_JSON).content(SEGNALAZIONE_VALIDA))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void utenteAutenticatoSuperaLaSecurityPerCreareSegnalazioni() throws Exception {
        mockMvc.perform(post("/api/segnalazioni").with(ruolo("UTENTE"))
                        .contentType(MediaType.APPLICATION_JSON).content(SEGNALAZIONE_VALIDA))
                .andExpect(result -> {
                    int stato = result.getResponse().getStatus();
                    if (stato == 401 || stato == 403) {
                        throw new AssertionError("Accesso negato a un utente autenticato: " + stato);
                    }
                });
    }

    @Test
    void gestioneCategorieRiservataAgliAdmin() throws Exception {
        mockMvc.perform(put("/api/categorie/1").with(ruolo("UTENTE"))
                        .contentType(MediaType.APPLICATION_JSON).content(CATEGORIA_VALIDA))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
        mockMvc.perform(put("/api/categorie/1").with(ruolo("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON).content(CATEGORIA_VALIDA))
                .andExpect(status().isOk());
    }

    @Test
    void gestioneUtentiEModerazioneRiservateAgliAdmin() throws Exception {
        mockMvc.perform(get("/api/utenti").with(ruolo("UTENTE"))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/utenti").with(ruolo("ADMIN"))).andExpect(status().isOk());
        mockMvc.perform(patch("/api/segnalazioni/1/riattiva").with(ruolo("UTENTE"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/segnalazioni/1/eventi-moderazione").with(ruolo("UTENTE")))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/segnalazioni/1").with(ruolo("UTENTE")))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/segnalazioni/1").with(ruolo("ADMIN")))
                .andExpect(status().isNoContent());
        mockMvc.perform(patch("/api/utenti/1/ruolo").with(ruolo("UTENTE"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"ruolo\": \"ADMIN\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void tabelleDiGestioneRiservateAgliAdmin() throws Exception {
        // "/api/segnalazioni/*" è pubblico in GET: "/gestione" non deve ricadere in quella regola.
        mockMvc.perform(get("/api/segnalazioni/gestione")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/segnalazioni/gestione").with(ruolo("UTENTE"))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/segnalazioni/gestione").with(ruolo("ADMIN"))).andExpect(status().isOk());
        // Idem per "/api/categorie/**", pubblico in GET.
        mockMvc.perform(get("/api/categorie/gestione")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/categorie/gestione").with(ruolo("UTENTE"))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/categorie/gestione").with(ruolo("ADMIN"))).andExpect(status().isOk());
        mockMvc.perform(get("/api/utenti/gestione").with(ruolo("UTENTE"))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/utenti/gestione").with(ruolo("ADMIN"))).andExpect(status().isOk());
    }

    @Test
    void filtriDellaGestioneLettiDallaQueryString() throws Exception {
        mockMvc.perform(get("/api/segnalazioni/gestione").with(ruolo("ADMIN"))
                        .param("categoriaId", "3").param("descrizione", "fumo").param("anonima", "true")
                        .param("stato", "ATTIVA").param("creataDal", "2026-09-01").param("creataAl", "2026-09-30")
                        .param("pagina", "2").param("dimensione", "10").param("ordina", "categoria,desc"))
                .andExpect(status().isOk());
        verify(segnalazioneService).trovaPerGestione(
                new FiltriSegnalazioni(null, 3L, "fumo", true, StatoSegnalazione.ATTIVA,
                        LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30), null, null),
                2, 10, "categoria,desc");
        mockMvc.perform(get("/api/utenti/gestione").with(ruolo("ADMIN"))
                        .param("email", "rossi").param("fiduciaMin", "20").param("ruolo", "ADMIN"))
                .andExpect(status().isOk());
        verify(utenteService).trovaPerGestione(
                new FiltriUtenti(null, null, "rossi", null, 20, null, null, RuoloUtente.ADMIN), 0, 25, null);
        mockMvc.perform(get("/api/categorie/gestione").with(ruolo("ADMIN"))
                        .param("nome", "furto").param("gravita", "3").param("attiva", "false").param("ordina", "nome"))
                .andExpect(status().isOk());
        verify(categoriaService).trovaPerGestione(new FiltriCategorie("furto", 3, null, null, false), 0, 25, "nome");
    }

    @Test
    void profiloRichiedeLoginMaNonIlRuoloAdmin() throws Exception {
        when(utenteCorrenteService.utenteCorrente())
                .thenReturn(Utente.builder().id(1L).ruolo(RuoloUtente.UTENTE).attivo(true).build());
        mockMvc.perform(put("/api/utenti/me")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"nome\": \"A\", \"cognome\": \"B\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(put("/api/utenti/me").with(ruolo("UTENTE"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"nome\": \"A\", \"cognome\": \"B\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(patch("/api/utenti/me/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"passwordAttuale\": \"vecchia123\", \"nuovaPassword\": \"nuova1234\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(patch("/api/utenti/me/password").with(ruolo("UTENTE"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"passwordAttuale\": \"vecchia123\", \"nuovaPassword\": \"nuova1234\"}"))
                .andExpect(status().isNoContent());
    }

    private static RequestPostProcessor ruolo(String ruolo) {
        return jwt().jwt(j -> j.subject("1").claim("ruolo", ruolo))
                .authorities(new SimpleGrantedAuthority("ROLE_" + ruolo));
    }
}
