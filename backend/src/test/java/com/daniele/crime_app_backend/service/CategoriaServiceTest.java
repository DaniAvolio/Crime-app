package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.CategoriaDto;
import com.daniele.crime_app_backend.dto.CategoriaRequest;
import com.daniele.crime_app_backend.dto.TraduzioneCategoriaDto;
import com.daniele.crime_app_backend.entity.Categoria;
import com.daniele.crime_app_backend.entity.TraduzioneCategoria;
import com.daniele.crime_app_backend.exception.ConflittoException;
import com.daniele.crime_app_backend.mapper.CategoriaMapper;
import com.daniele.crime_app_backend.repository.CategoriaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CategoriaServiceTest {

    @Mock
    private CategoriaRepository categoriaRepository;

    private CategoriaService service() {
        return new CategoriaService(categoriaRepository, new CategoriaMapper());
    }

    @Test
    void creaSalvaLeTraduzioniScartandoQuelleVuoteELaLinguaBase() {
        when(categoriaRepository.findByNome("Rissa")).thenReturn(Optional.empty());
        when(categoriaRepository.esisteTraduzione("en", "Brawl", null)).thenReturn(false);
        when(categoriaRepository.save(any(Categoria.class))).thenAnswer(invocazione -> invocazione.getArgument(0));

        CategoriaDto creata = service().crea(richiesta("Rissa", Map.of(
                "en", new TraduzioneCategoriaDto(" Brawl ", "  "),
                "fr", new TraduzioneCategoriaDto("", "Bagarre"),
                "it", new TraduzioneCategoriaDto("Rissa", null))));

        assertThat(creata.traduzioni()).containsOnlyKeys("en");
        assertThat(creata.traduzioni().get("en")).isEqualTo(new TraduzioneCategoriaDto("Brawl", null));
    }

    @Test
    void rifiutaUnNomeTradottoGiaUsatoDaUnAltraCategoria() {
        when(categoriaRepository.findByNome("Rissa")).thenReturn(Optional.empty());
        when(categoriaRepository.esisteTraduzione("en", "Assault", null)).thenReturn(true);

        assertThatThrownBy(() -> service().crea(richiesta("Rissa",
                Map.of("en", new TraduzioneCategoriaDto("Assault", null)))))
                .isInstanceOf(ConflittoException.class);
        verify(categoriaRepository, never()).save(any());
    }

    @Test
    void aggiornaSostituisceLeTraduzioniEsistenti() {
        Map<String, TraduzioneCategoria> traduzioni = new HashMap<>();
        traduzioni.put("en", new TraduzioneCategoria("Fight", null));
        traduzioni.put("de", new TraduzioneCategoria("Schlägerei", null));
        Categoria categoria = Categoria.builder().id(1L).nome("Rissa").durataValiditaOre(4).gravita(3)
                .traduzioni(traduzioni).build();
        when(categoriaRepository.findById(1L)).thenReturn(Optional.of(categoria));
        when(categoriaRepository.findByNome("Rissa")).thenReturn(Optional.of(categoria));
        when(categoriaRepository.esisteTraduzione("en", "Brawl", 1L)).thenReturn(false);

        service().aggiorna(1L, richiesta("Rissa", Map.of("en", new TraduzioneCategoriaDto("Brawl", "Fight"))));

        assertThat(categoria.getTraduzioni()).isSameAs(traduzioni)
                .containsOnlyKeys("en")
                .containsEntry("en", new TraduzioneCategoria("Brawl", "Fight"));
    }

    private static CategoriaRequest richiesta(String nome, Map<String, TraduzioneCategoriaDto> traduzioni) {
        return new CategoriaRequest(nome, null, "swords", 4, 3, traduzioni);
    }
}
