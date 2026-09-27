package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.entity.enums.RuoloUtente;
import com.daniele.crime_app_backend.exception.ConflittoException;
import com.daniele.crime_app_backend.mapper.UtenteMapper;
import com.daniele.crime_app_backend.repository.UtenteRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UtenteServiceTest {

    private static final String EMAIL_ADMIN = "capo@example.com";

    @Mock
    private UtenteRepository utenteRepository;

    private UtenteService service(String emailAdmin) {
        return new UtenteService(utenteRepository, new UtenteMapper(), new BCryptPasswordEncoder(), emailAdmin);
    }

    @Test
    void promuoveUnUtenteAdAdmin() {
        Utente utente = utente(1L, RuoloUtente.UTENTE);
        when(utenteRepository.findById(1L)).thenReturn(Optional.of(utente));

        service("").cambiaRuolo(1L, RuoloUtente.ADMIN);

        assertThat(utente.getRuolo()).isEqualTo(RuoloUtente.ADMIN);
    }

    @Test
    void revocaIlRuoloSeRestaAltroAdmin() {
        Utente admin = utente(1L, RuoloUtente.ADMIN);
        when(utenteRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(utenteRepository.countByRuoloAndAttivoTrue(RuoloUtente.ADMIN)).thenReturn(2L);

        service("").cambiaRuolo(1L, RuoloUtente.UTENTE);

        assertThat(admin.getRuolo()).isEqualTo(RuoloUtente.UTENTE);
    }

    @Test
    void nonRevocaNeDisattivaNeEliminaLUltimoAdmin() {
        Utente admin = utente(1L, RuoloUtente.ADMIN);
        when(utenteRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(utenteRepository.countByRuoloAndAttivoTrue(RuoloUtente.ADMIN)).thenReturn(1L);
        UtenteService service = service("");

        assertThatThrownBy(() -> service.cambiaRuolo(1L, RuoloUtente.UTENTE)).isInstanceOf(ConflittoException.class);
        assertThatThrownBy(() -> service.disattiva(1L)).isInstanceOf(ConflittoException.class);
        assertThatThrownBy(() -> service.eliminaDefinitivamente(1L)).isInstanceOf(ConflittoException.class);
        assertThat(admin.getRuolo()).isEqualTo(RuoloUtente.ADMIN);
        assertThat(admin.isAttivo()).isTrue();
        verify(utenteRepository, never()).delete(admin);
    }

    @Test
    void promuoveSoloLEmailConfigurataIgnorandoLeMaiuscole() {
        Utente configurato = utente(1L, RuoloUtente.UTENTE);
        configurato.setEmail("Capo@Example.com");
        Utente altro = utente(2L, RuoloUtente.UTENTE);

        service(EMAIL_ADMIN).promuoviSeAdminConfigurato(configurato);
        service(EMAIL_ADMIN).promuoviSeAdminConfigurato(altro);

        assertThat(configurato.getRuolo()).isEqualTo(RuoloUtente.ADMIN);
        assertThat(altro.getRuolo()).isEqualTo(RuoloUtente.UTENTE);
    }

    @Test
    void senzaEmailConfigurataNessunaPromozione() {
        Utente utente = utente(1L, RuoloUtente.UTENTE);
        utente.setEmail(EMAIL_ADMIN);

        service("").promuoviSeAdminConfigurato(utente);

        assertThat(utente.getRuolo()).isEqualTo(RuoloUtente.UTENTE);
    }

    private Utente utente(Long id, RuoloUtente ruolo) {
        return Utente.builder()
                .id(id)
                .nome("Mario")
                .cognome("Rossi")
                .email("utente" + id + "@example.com")
                .passwordHash("hash")
                .ruolo(ruolo)
                .build();
    }
}
