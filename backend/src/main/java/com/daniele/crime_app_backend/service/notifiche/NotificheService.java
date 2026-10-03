package com.daniele.crime_app_backend.service.notifiche;

import com.daniele.crime_app_backend.dto.NotificaDto;
import com.daniele.crime_app_backend.dto.PaginaDto;
import com.daniele.crime_app_backend.dto.SottoscrizionePushRequest;
import com.daniele.crime_app_backend.entity.DeviceToken;
import com.daniele.crime_app_backend.entity.Notifica;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.entity.enums.Piattaforma;
import com.daniele.crime_app_backend.exception.RisorsaNonTrovataException;
import com.daniele.crime_app_backend.repository.DeviceTokenRepository;
import com.daniele.crime_app_backend.repository.NotificaRepository;
import com.daniele.crime_app_backend.service.Paginazione;
import com.daniele.crime_app_backend.service.UtenteCorrenteService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Campanella (avvisi dell'utente autenticato) e sottoscrizioni Web Push dei suoi dispositivi.
 * Gli avvisi li crea SmistamentoNotifiche.
 */
@Slf4j
@Service
@Transactional(readOnly = true)
public class NotificheService {

    private final NotificaRepository notificaRepository;
    private final DeviceTokenRepository deviceTokenRepository;
    private final UtenteCorrenteService utenteCorrenteService;
    private final int giorniConservazione;

    public NotificheService(NotificaRepository notificaRepository, DeviceTokenRepository deviceTokenRepository,
                            UtenteCorrenteService utenteCorrenteService,
                            @Value("${crimeapp.notifiche.giorni-conservazione:30}") int giorniConservazione) {
        this.notificaRepository = notificaRepository;
        this.deviceTokenRepository = deviceTokenRepository;
        this.utenteCorrenteService = utenteCorrenteService;
        this.giorniConservazione = giorniConservazione;
    }

    public PaginaDto<NotificaDto> trovaMie(int pagina, int dimensione) {
        return PaginaDto.da(notificaRepository.findByUtenteIdOrderByDataCreazioneDescIdDesc(
                        utenteCorrenteService.idCorrente(), Paginazione.senzaOrdinamento(pagina, dimensione)),
                NotificheService::toDto);
    }

    public long contaNonLette() {
        return notificaRepository.countByUtenteIdAndLettaFalse(utenteCorrenteService.idCorrente());
    }

    @Transactional
    public void segnaLetta(Long id) {
        if (notificaRepository.segnaLetta(id, utenteCorrenteService.idCorrente()) == 0) {
            throw new RisorsaNonTrovataException("Notifica non trovata con id: " + id);
        }
    }

    @Transactional
    public void segnaTutteLette() {
        notificaRepository.segnaTutteLette(utenteCorrenteService.idCorrente());
    }

    /**
     * Upsert per endpoint: lo stesso browser può risottoscriversi (chiavi nuove) o passare a un
     * altro account; l'endpoint resta univoco e segue l'ultimo utente che l'ha registrato.
     */
    @Transactional
    public void sottoscrivi(SottoscrizionePushRequest request) {
        Utente utente = utenteCorrenteService.utenteCorrente();
        DeviceToken dispositivo = deviceTokenRepository.findByToken(request.endpoint())
                .orElseGet(() -> DeviceToken.builder().token(request.endpoint()).piattaforma(Piattaforma.WEB).build());
        dispositivo.setUtente(utente);
        dispositivo.setP256dh(request.p256dh());
        dispositivo.setAuth(request.auth());
        dispositivo.setLingua(MessaggiNotifica.linguaSupportata(request.lingua()));
        dispositivo.setUltimoUtilizzo(LocalDateTime.now());
        deviceTokenRepository.save(dispositivo);
    }

    /** Idempotente; un endpoint di un altro utente si ignora (non si rivela che esiste). */
    @Transactional
    public void disiscrivi(String endpoint) {
        Long utenteId = utenteCorrenteService.idCorrente();
        deviceTokenRepository.findByToken(endpoint)
                .filter(d -> Objects.equals(d.getUtente().getId(), utenteId))
                .ifPresent(deviceTokenRepository::delete);
    }

    /** Avvisi più vecchi del periodo di conservazione: la campanella resta leggera. */
    @Scheduled(cron = "${crimeapp.segnalazioni.anonimizzazione.cron:0 30 3 * * *}")
    @Transactional
    public void pulisci() {
        int eliminate = notificaRepository.eliminaPrimaDi(LocalDateTime.now().minusDays(giorniConservazione));
        if (eliminate > 0) {
            log.info("Avvisi eliminati (più vecchi di {} giorni): {}", giorniConservazione, eliminate);
        }
    }

    private static NotificaDto toDto(Notifica n) {
        return new NotificaDto(n.getId(), n.getTipo(), n.getSegnalazione().getId(),
                n.getSegnalazione().getCategoria().getId(), n.getZonaNome(), n.getSegnalazione().getStato(),
                n.getDataCreazione(), n.isLetta());
    }
}
