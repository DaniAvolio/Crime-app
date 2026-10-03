package com.daniele.crime_app_backend.controller;

import com.daniele.crime_app_backend.dto.NotificaDto;
import com.daniele.crime_app_backend.dto.PaginaDto;
import com.daniele.crime_app_backend.dto.SottoscrizionePushRequest;
import com.daniele.crime_app_backend.dto.ZonaNotificaDto;
import com.daniele.crime_app_backend.dto.ZonaNotificaRequest;
import com.daniele.crime_app_backend.service.ZoneNotificaService;
import com.daniele.crime_app_backend.service.notifiche.NotificheService;
import com.daniele.crime_app_backend.service.push.WebPushClient;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Notifiche dell'utente autenticato: avvisi (campanella), zone e sottoscrizioni push. La chiave
 * pubblica VAPID è pubblica (vedi SecurityConfig): il browser la usa per sottoscriversi.
 */
@RestController
public class NotificheController {

    private final NotificheService notificheService;
    private final ZoneNotificaService zoneNotificaService;
    private final WebPushClient webPushClient;

    public NotificheController(NotificheService notificheService, ZoneNotificaService zoneNotificaService,
                               WebPushClient webPushClient) {
        this.notificheService = notificheService;
        this.zoneNotificaService = zoneNotificaService;
        this.webPushClient = webPushClient;
    }

    @GetMapping("/api/push/chiave-pubblica")
    public Map<String, String> chiavePubblica() {
        return Map.of("chiave", webPushClient.chiavePubblica());
    }

    @PostMapping("/api/utenti/me/push")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void sottoscrivi(@Valid @RequestBody SottoscrizionePushRequest request) {
        notificheService.sottoscrivi(request);
    }

    @DeleteMapping("/api/utenti/me/push")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void disiscrivi(@RequestParam String endpoint) {
        notificheService.disiscrivi(endpoint);
    }

    @GetMapping("/api/utenti/me/notifiche")
    public PaginaDto<NotificaDto> notifiche(@RequestParam(defaultValue = "0") int pagina,
                                            @RequestParam(defaultValue = "20") int dimensione) {
        return notificheService.trovaMie(pagina, dimensione);
    }

    @GetMapping("/api/utenti/me/notifiche/non-lette")
    public long nonLette() {
        return notificheService.contaNonLette();
    }

    @PatchMapping("/api/utenti/me/notifiche/{id}/letta")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void segnaLetta(@PathVariable Long id) {
        notificheService.segnaLetta(id);
    }

    @PatchMapping("/api/utenti/me/notifiche/lette")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void segnaTutteLette() {
        notificheService.segnaTutteLette();
    }

    @GetMapping("/api/utenti/me/zone-notifica")
    public List<ZonaNotificaDto> zone() {
        return zoneNotificaService.trovaMie();
    }

    @PostMapping("/api/utenti/me/zone-notifica")
    @ResponseStatus(HttpStatus.CREATED)
    public ZonaNotificaDto creaZona(@Valid @RequestBody ZonaNotificaRequest request) {
        return zoneNotificaService.crea(request);
    }

    @PutMapping("/api/utenti/me/zone-notifica/{id}")
    public ZonaNotificaDto aggiornaZona(@PathVariable Long id, @Valid @RequestBody ZonaNotificaRequest request) {
        return zoneNotificaService.aggiorna(id, request);
    }

    @DeleteMapping("/api/utenti/me/zone-notifica/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminaZona(@PathVariable Long id) {
        zoneNotificaService.elimina(id);
    }
}
