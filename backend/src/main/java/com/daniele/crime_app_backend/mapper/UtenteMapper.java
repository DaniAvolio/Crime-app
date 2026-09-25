package com.daniele.crime_app_backend.mapper;

import com.daniele.crime_app_backend.dto.UtenteDto;
import com.daniele.crime_app_backend.entity.Utente;
import org.springframework.stereotype.Component;

@Component
public class UtenteMapper {

    public UtenteDto toDto(Utente utente) {
        return new UtenteDto(
                utente.getId(),
                utente.getNome(),
                utente.getCognome(),
                utente.getEmail(),
                utente.isIdentitaVerificata(),
                utente.getPunteggioFiducia(),
                utente.isAttivo(),
                utente.getDataRegistrazione(),
                utente.getDataAggiornamento()
        );
    }
}
