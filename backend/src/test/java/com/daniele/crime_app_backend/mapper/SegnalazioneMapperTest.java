package com.daniele.crime_app_backend.mapper;

import com.daniele.crime_app_backend.dto.SegnalazioneDto;
import com.daniele.crime_app_backend.entity.Categoria;
import com.daniele.crime_app_backend.entity.Segnalazione;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.service.UtenteCorrenteService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SegnalazioneMapperTest {

    private static final long ID_AUTORE = 7L;

    @Mock
    private UtenteCorrenteService utenteCorrenteService;

    @Test
    void mostraNomeEInizialeAgliUtentiAutenticati() {
        autenticatoCome(99L, false);

        SegnalazioneDto dto = mapper().toDto(segnalazione(false));

        assertThat(dto.autoreNome()).isEqualTo("Mario R.");
    }

    @Test
    void nonMostraIlNomeAChiNonHaFattoLAccesso() {
        when(utenteCorrenteService.idCorrenteOpzionale()).thenReturn(Optional.empty());

        SegnalazioneDto dto = mapper().toDto(segnalazione(false));

        assertThat(dto.autoreNome()).isNull();
        assertThat(dto.autoreId()).isEqualTo(ID_AUTORE);
    }

    @Test
    void nonMostraIlNomeDelleSegnalazioniAnonime() {
        autenticatoCome(99L, false);

        SegnalazioneDto dto = mapper().toDto(segnalazione(true));

        assertThat(dto.autoreNome()).isNull();
        assertThat(dto.autoreId()).isNull();
    }

    @Test
    void lAutoreEGliAdminVedonoIlNomeAncheSeAnonima() {
        autenticatoCome(ID_AUTORE, false);
        assertThat(mapper().toDto(segnalazione(true)).autoreNome()).isEqualTo("Mario R.");

        autenticatoCome(99L, true);
        assertThat(mapper().toDto(segnalazione(true)).autoreNome()).isEqualTo("Mario R.");
    }

    @Test
    void unaSegnalazioneAnonimizzataNonHaAutoreNeanchePerGliAdmin() {
        autenticatoCome(99L, true);
        Segnalazione anonimizzata = segnalazione(false);
        anonimizzata.setAutore(null);

        SegnalazioneDto dto = mapper().toDto(anonimizzata);

        assertThat(dto.autoreId()).isNull();
        assertThat(dto.autoreNome()).isNull();
    }

    private void autenticatoCome(long id, boolean admin) {
        lenient().when(utenteCorrenteService.idCorrenteOpzionale()).thenReturn(Optional.of(id));
        lenient().when(utenteCorrenteService.isAdmin()).thenReturn(admin);
    }

    private SegnalazioneMapper mapper() {
        return new SegnalazioneMapper(utenteCorrenteService);
    }

    private Segnalazione segnalazione(boolean anonima) {
        SegnalazioneMapper mapper = mapper();
        return Segnalazione.builder()
                .id(1L)
                .autore(Utente.builder().id(ID_AUTORE).nome("Mario").cognome("rossi").build())
                .categoria(Categoria.builder().id(3L).nome("Furto").gravita(2).build())
                .descrizione("Bici rubata")
                .posizione(mapper.creaPunto(45.3, 8.8))
                .anonima(anonima)
                .dataCreazione(LocalDateTime.now())
                .dataScadenza(LocalDateTime.now().plusHours(24))
                .build();
    }
}
