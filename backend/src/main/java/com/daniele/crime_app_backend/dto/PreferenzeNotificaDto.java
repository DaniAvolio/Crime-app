package com.daniele.crime_app_backend.dto;

/** Rappresentazione di PreferenzeNotifica esposta via API. */
public record PreferenzeNotificaDto(
        Long id,
        Long utenteId,
        Integer raggioNotificaMetri,
        boolean notificheAttive,
        boolean notificheSoloCategoriePreferite
) {}
