package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.dto.CellaCaloreDto;
import com.daniele.crime_app_backend.dto.ConteggioCategoriaDto;
import com.daniele.crime_app_backend.dto.FasciaOrariaDto;
import com.daniele.crime_app_backend.dto.ModerazioneStatisticheDto.AbusiPerMotivo;
import com.daniele.crime_app_backend.entity.enums.MotivoAbuso;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Aggregazioni per le statistiche, tutte nel database (il client non riceve mai segnalazioni
 * singole). Contano le segnalazioni ATTIVA e SCADUTA, comprese le anonimizzate: RIMOSSA e SOSPESA
 * (false o in moderazione) falserebbero i numeri. Ogni query filtra per periodo di creazione
 * (indice idx_segnalazione_data_creazione) e poi per area, gravità e categoria.
 */
@Repository
public class StatisticheRepository {

    /** Periodo [da, a), riquadro della mappa e filtri facoltativi (null = tutti). */
    public record Ambito(LocalDateTime da, LocalDateTime a, Integer gravita, Long categoriaId,
                         double minLat, double minLng, double maxLat, double maxLng) {

        Ambito spostatoA(LocalDateTime nuovoDa, LocalDateTime nuovoA) {
            return new Ambito(nuovoDa, nuovoA, gravita, categoriaId, minLat, minLng, maxLat, maxLng);
        }
    }

    private static final String DA_DOVE = """
             FROM segnalazione s
             JOIN categoria c ON c.id = s.categoria_id
             WHERE s.stato IN ('ATTIVA', 'SCADUTA')
               AND s.data_creazione >= :da AND s.data_creazione < :a
               AND s.posizione::geometry && ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326)
               AND (CAST(:gravita AS integer) IS NULL OR c.gravita = CAST(:gravita AS integer))
               AND (CAST(:categoriaId AS bigint) IS NULL OR s.categoria_id = CAST(:categoriaId AS bigint))
            """;

    private final NamedParameterJdbcTemplate jdbc;

    public StatisticheRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static MapSqlParameterSource parametri(Ambito ambito) {
        return new MapSqlParameterSource()
                .addValue("da", ambito.da())
                .addValue("a", ambito.a())
                .addValue("gravita", ambito.gravita())
                .addValue("categoriaId", ambito.categoriaId())
                .addValue("minLat", ambito.minLat())
                .addValue("minLng", ambito.minLng())
                .addValue("maxLat", ambito.maxLat())
                .addValue("maxLng", ambito.maxLng());
    }

    /** Celle della griglia (lato in gradi) con il loro conteggio, dalle più piene. */
    public List<CellaCaloreDto> celle(Ambito ambito, double cella, int limite) {
        String sql = """
                SELECT ST_Y(g.centro) AS lat, ST_X(g.centro) AS lng, g.numero FROM (
                    SELECT ST_SnapToGrid(s.posizione::geometry, :cella) AS centro, count(*) AS numero
                """ + DA_DOVE + """
                    GROUP BY 1
                ) g ORDER BY g.numero DESC LIMIT :limite
                """;
        return jdbc.query(sql, parametri(ambito).addValue("cella", cella).addValue("limite", limite),
                (rs, i) -> new CellaCaloreDto(arrotonda(rs.getDouble("lat")), arrotonda(rs.getDouble("lng")),
                        rs.getLong("numero")));
    }

    /** ST_SnapToGrid lascia rumore di virgola mobile (45.07499999…): 6 decimali bastano (~10 cm). */
    private static double arrotonda(double gradi) {
        return Math.round(gradi * 1e6) / 1e6;
    }

    /** [totale, gravi (gravità 3)]. */
    public long[] totali(Ambito ambito) {
        String sql = "SELECT count(*) AS totale, count(*) FILTER (WHERE c.gravita = 3) AS gravi" + DA_DOVE;
        return jdbc.queryForObject(sql, parametri(ambito),
                (rs, i) -> new long[] {rs.getLong("totale"), rs.getLong("gravi")});
    }

    public long totale(Ambito ambito, LocalDateTime da, LocalDateTime a) {
        return totali(ambito.spostatoA(da, a))[0];
    }

    /** Conteggi per periodo: unita è 'day', 'week' (dal lunedì) o 'month' di date_trunc. */
    public Map<LocalDate, Long> andamento(Ambito ambito, String unita) {
        String sql = "SELECT CAST(date_trunc(:unita, s.data_creazione) AS date) AS periodo, count(*) AS numero"
                + DA_DOVE + " GROUP BY 1 ORDER BY 1";
        Map<LocalDate, Long> risultato = new LinkedHashMap<>();
        jdbc.query(sql, parametri(ambito).addValue("unita", unita),
                rs -> {
                    risultato.put(rs.getDate("periodo").toLocalDate(), rs.getLong("numero"));
                });
        return risultato;
    }

    /** Conteggi per giorno della settimana (ISO, 1 = lunedì) e ora, solo combinazioni non vuote. */
    public List<FasciaOrariaDto> fasce(Ambito ambito) {
        String sql = """
                SELECT CAST(extract(isodow FROM s.data_creazione) AS integer) AS giorno,
                       CAST(extract(hour FROM s.data_creazione) AS integer) AS ora, count(*) AS numero
                """ + DA_DOVE + " GROUP BY 1, 2";
        return jdbc.query(sql, parametri(ambito),
                (rs, i) -> new FasciaOrariaDto(rs.getInt("giorno"), rs.getInt("ora"), rs.getLong("numero")));
    }

    /** Conteggi per categoria, dalla più frequente. */
    public List<ConteggioCategoriaDto> categorie(Ambito ambito) {
        String sql = "SELECT s.categoria_id AS categoria, count(*) AS numero" + DA_DOVE
                + " GROUP BY s.categoria_id ORDER BY numero DESC";
        return jdbc.query(sql, parametri(ambito),
                (rs, i) -> new ConteggioCategoriaDto(rs.getLong("categoria"), rs.getLong("numero")));
    }

    // ------------------------------------------------------------------ moderazione (solo admin)

    private static MapSqlParameterSource periodo(LocalDateTime da, LocalDateTime a) {
        return new MapSqlParameterSource().addValue("da", da).addValue("a", a);
    }

    /** Abusi inviati nel periodo, per motivo e per esito. */
    public List<AbusiPerMotivo> abusiPerMotivo(LocalDateTime da, LocalDateTime a) {
        String sql = """
                SELECT motivo, count(*) AS totale,
                       count(*) FILTER (WHERE esito = 'FONDATO') AS accolti,
                       count(*) FILTER (WHERE esito = 'INFONDATO') AS respinti,
                       count(*) FILTER (WHERE esito IS NULL) AS in_attesa
                FROM segnalazione_abuso
                WHERE data_segnalazione >= :da AND data_segnalazione < :a
                GROUP BY motivo ORDER BY totale DESC
                """;
        return jdbc.query(sql, periodo(da, a), (rs, i) -> new AbusiPerMotivo(MotivoAbuso.valueOf(rs.getString("motivo")),
                rs.getLong("totale"), rs.getLong("accolti"), rs.getLong("respinti"), rs.getLong("in_attesa")));
    }

    /** Ore medie tra l'invio di un abuso e la decisione, per le decisioni prese nel periodo. */
    public Double oreMedieRevisione(LocalDateTime da, LocalDateTime a) {
        String sql = """
                SELECT avg(extract(epoch FROM data_esito - data_segnalazione)) / 3600 FROM segnalazione_abuso
                WHERE data_esito >= :da AND data_esito < :a
                """;
        return jdbc.queryForObject(sql, periodo(da, a), Double.class);
    }

    /** Transizioni verso uno stato nel periodo (es. RIMOSSA da ADMIN, SOSPESA dal sistema). */
    public long transizioni(LocalDateTime da, LocalDateTime a, String statoNuovo, String tipoAttore) {
        String sql = """
                SELECT count(*) FROM evento_moderazione
                WHERE data_evento >= :da AND data_evento < :a AND stato_nuovo = :stato
                  AND (CAST(:attore AS varchar) IS NULL OR tipo_attore = CAST(:attore AS varchar))
                """;
        return jdbc.queryForObject(sql, periodo(da, a).addValue("stato", statoNuovo).addValue("attore", tipoAttore),
                Long.class);
    }

    /** Segnalazioni create nel periodo e messe in coda dai controlli automatici sulla descrizione. */
    public long controlliAutomatici(LocalDateTime da, LocalDateTime a) {
        String sql = """
                SELECT count(*) FROM segnalazione
                WHERE data_creazione >= :da AND data_creazione < :a AND revisione_automatica IS NOT NULL
                """;
        return jdbc.queryForObject(sql, periodo(da, a), Long.class);
    }

    public long nuoviUtenti(LocalDateTime da, LocalDateTime a) {
        String sql = "SELECT count(*) FROM utente WHERE data_registrazione >= :da AND data_registrazione < :a";
        return jdbc.queryForObject(sql, periodo(da, a), Long.class);
    }
}
