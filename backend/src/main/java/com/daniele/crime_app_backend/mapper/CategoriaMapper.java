package com.daniele.crime_app_backend.mapper;

import com.daniele.crime_app_backend.dto.CategoriaDto;
import com.daniele.crime_app_backend.dto.CategoriaRequest;
import com.daniele.crime_app_backend.entity.Categoria;
import org.springframework.stereotype.Component;

@Component
public class CategoriaMapper {

    public CategoriaDto toDto(Categoria categoria) {
        return new CategoriaDto(
                categoria.getId(),
                categoria.getNome(),
                categoria.getDescrizione(),
                categoria.getIcona(),
                categoria.getDurataValiditaOre(),
                categoria.isAttiva()
        );
    }

    public Categoria toEntity(CategoriaRequest request) {
        return Categoria.builder()
                .nome(request.nome())
                .descrizione(request.descrizione())
                .icona(request.icona())
                .durataValiditaOre(request.durataValiditaOre())
                .attiva(true)
                .build();
    }

    /** Applica i campi del payload a un'entità già gestita da JPA (aggiornamento in place). */
    public void aggiornaEntity(Categoria categoria, CategoriaRequest request) {
        categoria.setNome(request.nome());
        categoria.setDescrizione(request.descrizione());
        categoria.setIcona(request.icona());
        categoria.setDurataValiditaOre(request.durataValiditaOre());
    }
}
