package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.DeviceTokenDto;
import com.daniele.crime_app_backend.dto.DeviceTokenRequest;
import com.daniele.crime_app_backend.entity.DeviceToken;
import com.daniele.crime_app_backend.entity.Utente;
import com.daniele.crime_app_backend.exception.AccessoNegatoException;
import com.daniele.crime_app_backend.mapper.DeviceTokenMapper;
import com.daniele.crime_app_backend.repository.DeviceTokenRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class DeviceTokenService {

    private final DeviceTokenRepository deviceTokenRepository;
    private final DeviceTokenMapper deviceTokenMapper;
    private final UtenteCorrenteService utenteCorrenteService;

    public DeviceTokenService(DeviceTokenRepository deviceTokenRepository, DeviceTokenMapper deviceTokenMapper,
                               UtenteCorrenteService utenteCorrenteService) {
        this.deviceTokenRepository = deviceTokenRepository;
        this.deviceTokenMapper = deviceTokenMapper;
        this.utenteCorrenteService = utenteCorrenteService;
    }

    public List<DeviceTokenDto> trovaPerUtenteCorrente() {
        return deviceTokenRepository.findByUtenteId(utenteCorrenteService.idCorrente()).stream()
                .map(deviceTokenMapper::toDto)
                .toList();
    }

    /**
     * Upsert per token: il token del dispositivo è univoco a livello DB, ma un
     * dispositivo può essere ri-registrato (es. riavvio app, cambio account)
     * quindi un token già esistente viene riassegnato all'utente corrente invece di fallire.
     */
    @Transactional
    public DeviceTokenDto registra(DeviceTokenRequest request) {
        Utente utente = utenteCorrenteService.utenteCorrente();
        DeviceToken deviceToken = deviceTokenRepository.findByToken(request.token()).orElse(null);
        if (deviceToken == null) {
            deviceToken = DeviceToken.builder()
                    .utente(utente)
                    .token(request.token())
                    .piattaforma(request.piattaforma())
                    .ultimoUtilizzo(LocalDateTime.now())
                    .build();
            return deviceTokenMapper.toDto(deviceTokenRepository.save(deviceToken));
        }
        deviceToken.setUtente(utente);
        deviceToken.setPiattaforma(request.piattaforma());
        deviceToken.setUltimoUtilizzo(LocalDateTime.now());
        return deviceTokenMapper.toDto(deviceToken);
    }

    /** Idempotente: un token inesistente non è un errore, uno di un altro utente sì. */
    @Transactional
    public void rimuovi(String token) {
        Long utenteId = utenteCorrenteService.idCorrente();
        deviceTokenRepository.findByToken(token).ifPresent(deviceToken -> {
            if (!deviceToken.getUtente().getId().equals(utenteId)) {
                throw new AccessoNegatoException("Il device token non appartiene all'utente corrente");
            }
            deviceTokenRepository.delete(deviceToken);
        });
    }
}
