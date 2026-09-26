package com.daniele.crime_app_backend.mapper;

import com.daniele.crime_app_backend.dto.SegnalazioneDto;
import com.daniele.crime_app_backend.entity.Segnalazione;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.stereotype.Component;

@Component
public class SegnalazioneMapper {

    /** SRID 4326 (WGS84), coerente con la colonna geography(Point,4326) su DB. */
    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    public SegnalazioneDto toDto(Segnalazione segnalazione) {
        return new SegnalazioneDto(
                segnalazione.getId(),
                segnalazione.getAutore().getId(),
                segnalazione.getCategoria().getId(),
                segnalazione.getCategoria().getNome(),
                segnalazione.getDescrizione(),
                segnalazione.getPosizione().getY(),
                segnalazione.getPosizione().getX(),
                segnalazione.isAnonima(),
                segnalazione.getStato(),
                segnalazione.getDataCreazione(),
                segnalazione.getDataScadenza(),
                segnalazione.getDataRimozione(),
                segnalazione.getDataUltimaConferma()
        );
    }

    /** Point PostGIS: x = longitudine, y = latitudine. */
    public Point creaPunto(double lat, double lng) {
        return GEOMETRY_FACTORY.createPoint(new Coordinate(lng, lat));
    }
}
