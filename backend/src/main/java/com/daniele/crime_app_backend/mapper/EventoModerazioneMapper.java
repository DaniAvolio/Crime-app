package com.daniele.crime_app_backend.mapper;

import com.daniele.crime_app_backend.dto.EventoModerazioneDto;
import com.daniele.crime_app_backend.entity.EventoModerazione;
import org.springframework.stereotype.Component;

@Component
public class EventoModerazioneMapper {

    public EventoModerazioneDto toDto(EventoModerazione evento) {
        return new EventoModerazioneDto(
                evento.getId(),
                evento.getSegnalazione().getId(),
                evento.getStatoPrecedente(),
                evento.getStatoNuovo(),
                evento.getTipoAttore(),
                evento.getAmministratore() != null ? evento.getAmministratore().getId() : null,
                evento.getMotivazione(),
                evento.getDataEvento()
        );
    }
}
