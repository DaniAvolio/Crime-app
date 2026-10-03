package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.ZonaNotificaDto;
import com.daniele.crime_app_backend.dto.ZonaNotificaRequest;
import com.daniele.crime_app_backend.entity.ZonaNotifica;
import com.daniele.crime_app_backend.exception.RichiestaNonValidaException;
import com.daniele.crime_app_backend.exception.RisorsaNonTrovataException;
import com.daniele.crime_app_backend.mapper.SegnalazioneMapper;
import com.daniele.crime_app_backend.repository.ZonaNotificaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Zone di notifica dell'utente autenticato (es. Casa, Lavoro): al massimo ZONE_MASSIME. */
@Service
@Transactional(readOnly = true)
public class ZoneNotificaService {

    static final int ZONE_MASSIME = 5;

    private final ZonaNotificaRepository zonaNotificaRepository;
    private final SegnalazioneMapper segnalazioneMapper;
    private final UtenteCorrenteService utenteCorrenteService;

    public ZoneNotificaService(ZonaNotificaRepository zonaNotificaRepository, SegnalazioneMapper segnalazioneMapper,
                               UtenteCorrenteService utenteCorrenteService) {
        this.zonaNotificaRepository = zonaNotificaRepository;
        this.segnalazioneMapper = segnalazioneMapper;
        this.utenteCorrenteService = utenteCorrenteService;
    }

    public List<ZonaNotificaDto> trovaMie() {
        return zonaNotificaRepository.findByUtenteIdOrderByDataCreazioneAsc(utenteCorrenteService.idCorrente())
                .stream().map(ZoneNotificaService::toDto).toList();
    }

    @Transactional
    public ZonaNotificaDto crea(ZonaNotificaRequest request) {
        Long utenteId = utenteCorrenteService.idCorrente();
        if (zonaNotificaRepository.countByUtenteId(utenteId) >= ZONE_MASSIME) {
            throw new RichiestaNonValidaException("Puoi salvare al massimo " + ZONE_MASSIME + " zone");
        }
        ZonaNotifica zona = ZonaNotifica.builder()
                .utente(utenteCorrenteService.utenteCorrente())
                .build();
        applica(zona, request);
        return toDto(zonaNotificaRepository.save(zona));
    }

    @Transactional
    public ZonaNotificaDto aggiorna(Long id, ZonaNotificaRequest request) {
        ZonaNotifica zona = recuperaMia(id);
        applica(zona, request);
        return toDto(zona);
    }

    @Transactional
    public void elimina(Long id) {
        zonaNotificaRepository.delete(recuperaMia(id));
    }

    private ZonaNotifica recuperaMia(Long id) {
        return zonaNotificaRepository.findByIdAndUtenteId(id, utenteCorrenteService.idCorrente())
                .orElseThrow(() -> new RisorsaNonTrovataException("Zona non trovata con id: " + id));
    }

    private void applica(ZonaNotifica zona, ZonaNotificaRequest request) {
        zona.setNome(request.nome().strip());
        zona.setPosizione(segnalazioneMapper.creaPunto(request.lat(), request.lng()));
        zona.setRaggioMetri(request.raggioMetri());
    }

    private static ZonaNotificaDto toDto(ZonaNotifica zona) {
        return new ZonaNotificaDto(zona.getId(), zona.getNome(), zona.getPosizione().getY(),
                zona.getPosizione().getX(), zona.getRaggioMetri());
    }
}
