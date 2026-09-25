package com.daniele.crime_app_backend.mapper;

import com.daniele.crime_app_backend.dto.PreferenzeNotificaDto;
import com.daniele.crime_app_backend.dto.PreferenzeNotificaRequest;
import com.daniele.crime_app_backend.entity.PreferenzeNotifica;
import com.daniele.crime_app_backend.entity.Utente;
import org.springframework.stereotype.Component;

@Component
public class PreferenzeNotificaMapper {

    public PreferenzeNotificaDto toDto(PreferenzeNotifica preferenze) {
        return new PreferenzeNotificaDto(
                preferenze.getId(),
                preferenze.getUtente().getId(),
                preferenze.getRaggioNotificaMetri(),
                preferenze.isNotificheAttive(),
                preferenze.isNotificheSoloCategoriePreferite()
        );
    }

    public PreferenzeNotifica toEntity(Utente utente, PreferenzeNotificaRequest request) {
        return PreferenzeNotifica.builder()
                .utente(utente)
                .raggioNotificaMetri(request.raggioNotificaMetri())
                .notificheAttive(request.notificheAttive())
                .notificheSoloCategoriePreferite(request.notificheSoloCategoriePreferite())
                .build();
    }

    public void aggiornaEntity(PreferenzeNotifica preferenze, PreferenzeNotificaRequest request) {
        preferenze.setRaggioNotificaMetri(request.raggioNotificaMetri());
        preferenze.setNotificheAttive(request.notificheAttive());
        preferenze.setNotificheSoloCategoriePreferite(request.notificheSoloCategoriePreferite());
    }
}
