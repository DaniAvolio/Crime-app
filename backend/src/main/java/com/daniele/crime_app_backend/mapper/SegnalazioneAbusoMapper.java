package com.daniele.crime_app_backend.mapper;

import com.daniele.crime_app_backend.dto.SegnalazioneAbusoDto;
import com.daniele.crime_app_backend.entity.SegnalazioneAbuso;
import org.springframework.stereotype.Component;

@Component
public class SegnalazioneAbusoMapper {

    public SegnalazioneAbusoDto toDto(SegnalazioneAbuso segnalazioneAbuso) {
        return new SegnalazioneAbusoDto(
                segnalazioneAbuso.getId(),
                segnalazioneAbuso.getSegnalazione().getId(),
                segnalazioneAbuso.getUtente().getId(),
                segnalazioneAbuso.getMotivo(),
                segnalazioneAbuso.getDataSegnalazione()
        );
    }
}
