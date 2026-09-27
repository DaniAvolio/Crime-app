package com.daniele.crime_app_backend.config;

import com.daniele.crime_app_backend.controller.AuthController;
import com.daniele.crime_app_backend.controller.CategoriaController;
import com.daniele.crime_app_backend.controller.SegnalazioneController;
import com.daniele.crime_app_backend.controller.UtenteController;
import com.daniele.crime_app_backend.repository.UtenteRepository;
import com.daniele.crime_app_backend.service.AuthService;
import com.daniele.crime_app_backend.service.CategoriaService;
import com.daniele.crime_app_backend.service.SegnalazioneService;
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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
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
            {"nome": "Furto", "durataValiditaOre": 24}
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
        mockMvc.perform(patch("/api/utenti/1/ruolo").with(ruolo("UTENTE"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"ruolo\": \"ADMIN\"}"))
                .andExpect(status().isForbidden());
    }

    private static RequestPostProcessor ruolo(String ruolo) {
        return jwt().jwt(j -> j.subject("1").claim("ruolo", ruolo))
                .authorities(new SimpleGrantedAuthority("ROLE_" + ruolo));
    }
}
