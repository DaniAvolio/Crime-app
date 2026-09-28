package com.daniele.crime_app_backend.mapper;

import com.daniele.crime_app_backend.dto.CategoriaDto;
import com.daniele.crime_app_backend.dto.CategoriaRequest;
import com.daniele.crime_app_backend.dto.TraduzioneCategoriaDto;
import com.daniele.crime_app_backend.entity.Categoria;
import com.daniele.crime_app_backend.entity.TraduzioneCategoria;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
public class CategoriaMapper {

    /** Lingua di nome e descrizione della categoria: non ha righe di traduzione. */
    public static final String LINGUA_BASE = "it";

    public CategoriaDto toDto(Categoria categoria) {
        Map<String, TraduzioneCategoriaDto> traduzioni = new HashMap<>();
        categoria.getTraduzioni().forEach((lingua, traduzione) ->
                traduzioni.put(lingua, new TraduzioneCategoriaDto(traduzione.getNome(), traduzione.getDescrizione())));
        return new CategoriaDto(
                categoria.getId(),
                categoria.getNome(),
                categoria.getDescrizione(),
                categoria.getIcona(),
                categoria.getDurataValiditaOre(),
                categoria.getGravita(),
                categoria.isAttiva(),
                traduzioni
        );
    }

    public Categoria toEntity(CategoriaRequest request) {
        return Categoria.builder()
                .nome(request.nome())
                .descrizione(request.descrizione())
                .icona(request.icona())
                .durataValiditaOre(request.durataValiditaOre())
                .gravita(request.gravita())
                .attiva(true)
                .traduzioni(traduzioniEntity(request.traduzioni()))
                .build();
    }

    /** Applica i campi del payload a un'entità già gestita da JPA (aggiornamento in place). */
    public void aggiornaEntity(Categoria categoria, CategoriaRequest request) {
        categoria.setNome(request.nome());
        categoria.setDescrizione(request.descrizione());
        categoria.setIcona(request.icona());
        categoria.setDurataValiditaOre(request.durataValiditaOre());
        categoria.setGravita(request.gravita());
        // La map è gestita da Hibernate: va aggiornata in place, non sostituita.
        categoria.getTraduzioni().clear();
        categoria.getTraduzioni().putAll(traduzioniEntity(request.traduzioni()));
    }

    /**
     * Converte le traduzioni del payload scartando quelle senza nome (per quella
     * lingua si userà il fallback italiano) e quella della lingua base.
     */
    public Map<String, TraduzioneCategoria> traduzioniEntity(Map<String, TraduzioneCategoriaDto> traduzioni) {
        Map<String, TraduzioneCategoria> risultato = new HashMap<>();
        if (traduzioni == null) {
            return risultato;
        }
        traduzioni.forEach((lingua, traduzione) -> {
            if (LINGUA_BASE.equals(lingua) || traduzione == null || isVuota(traduzione.nome())) {
                return;
            }
            String descrizione = isVuota(traduzione.descrizione()) ? null : traduzione.descrizione().trim();
            risultato.put(lingua, new TraduzioneCategoria(traduzione.nome().trim(), descrizione));
        });
        return risultato;
    }

    private static boolean isVuota(String testo) {
        return testo == null || testo.isBlank();
    }
}
