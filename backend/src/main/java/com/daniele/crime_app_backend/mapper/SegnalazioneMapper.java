package com.daniele.crime_app_backend.mapper;

import com.daniele.crime_app_backend.dto.SegnalazioneDto;
import com.daniele.crime_app_backend.entity.Segnalazione;
import com.daniele.crime_app_backend.service.UtenteCorrenteService;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.stereotype.Component;

@Component
public class SegnalazioneMapper {

    /** SRID 4326 (WGS84), coerente con la colonna geography(Point,4326) su DB. */
    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    private final UtenteCorrenteService utenteCorrenteService;

    public SegnalazioneMapper(UtenteCorrenteService utenteCorrenteService) {
        this.utenteCorrenteService = utenteCorrenteService;
    }

    public SegnalazioneDto toDto(Segnalazione segnalazione) {
        return new SegnalazioneDto(
                segnalazione.getId(),
                autoreVisibile(segnalazione) ? segnalazione.getAutore().getId() : null,
                segnalazione.getCategoria().getId(),
                segnalazione.getCategoria().getNome(),
                segnalazione.getCategoria().getGravita(),
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

    /**
     * Una segnalazione anonima non espone l'autore, tranne all'autore stesso (per
     * riconoscere le proprie) e agli admin (per la moderazione).
     */
    private boolean autoreVisibile(Segnalazione segnalazione) {
        if (!segnalazione.isAnonima() || utenteCorrenteService.isAdmin()) {
            return true;
        }
        return utenteCorrenteService.idCorrenteOpzionale()
                .map(id -> id.equals(segnalazione.getAutore().getId()))
                .orElse(false);
    }

    /** Point PostGIS: x = longitudine, y = latitudine. */
    public Point creaPunto(double lat, double lng) {
        return GEOMETRY_FACTORY.createPoint(new Coordinate(lng, lat));
    }
}
