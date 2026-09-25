package com.daniele.crime_app_backend.mapper;

import com.daniele.crime_app_backend.dto.DeviceTokenDto;
import org.springframework.stereotype.Component;
import com.daniele.crime_app_backend.entity.DeviceToken;

@Component
public class DeviceTokenMapper {

    public DeviceTokenDto toDto(DeviceToken deviceToken) {
        return new DeviceTokenDto(
                deviceToken.getId(),
                deviceToken.getUtente().getId(),
                deviceToken.getToken(),
                deviceToken.getPiattaforma(),
                deviceToken.getDataRegistrazione(),
                deviceToken.getUltimoUtilizzo()
        );
    }
}
