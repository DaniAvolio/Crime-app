package com.daniele.crime_app_backend.dto;

/** Zona di notifica dell'utente corrente: centro (lat/lng) e raggio in metri. */
public record ZonaNotificaDto(Long id, String nome, double lat, double lng, int raggioMetri) {}
