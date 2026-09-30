package com.daniele.crime_app_backend.mapper;

import com.daniele.crime_app_backend.dto.SegnalazioneDto;
import com.daniele.crime_app_backend.entity.Segnalazione;
import com.daniele.crime_app_backend.entity.Utente;
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
        return toDto(segnalazione, null);
    }

    /** Con il voto dell'utente corrente ("è ancora in atto?"), per mappa e dettaglio. */
    public SegnalazioneDto toDto(Segnalazione segnalazione, Boolean mioVoto) {
        boolean autoreVisibile = autoreVisibile(segnalazione);
        // Il nome si mostra solo a chi ha fatto l'accesso: la mappa è consultabile anche da anonimi.
        boolean nomeVisibile = autoreVisibile && utenteCorrenteService.idCorrenteOpzionale().isPresent();
        return new SegnalazioneDto(
                segnalazione.getId(),
                autoreVisibile ? segnalazione.getAutore().getId() : null,
                nomeVisibile ? nomeBreve(segnalazione.getAutore()) : null,
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
                segnalazione.getDataUltimaConferma(),
                mioVoto
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

    /** "Mario R.": riconoscibile senza esporre il cognome completo. */
    private static String nomeBreve(Utente autore) {
        String cognome = autore.getCognome();
        return cognome == null || cognome.isBlank()
                ? autore.getNome()
                : autore.getNome() + " " + cognome.substring(0, 1).toUpperCase() + ".";
    }

    /** Point PostGIS: x = longitudine, y = latitudine. */
    public Point creaPunto(double lat, double lng) {
        return GEOMETRY_FACTORY.createPoint(new Coordinate(lng, lat));
    }
}
