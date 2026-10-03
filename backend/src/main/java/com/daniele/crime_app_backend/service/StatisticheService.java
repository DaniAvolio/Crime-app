package com.daniele.crime_app_backend.service;

import com.daniele.crime_app_backend.dto.CellaCaloreDto;
import com.daniele.crime_app_backend.dto.FiltriStatistiche;
import com.daniele.crime_app_backend.dto.GranularitaAndamento;
import com.daniele.crime_app_backend.dto.ModerazioneStatisticheDto;
import com.daniele.crime_app_backend.dto.PuntoAndamentoDto;
import com.daniele.crime_app_backend.dto.RiepilogoStatisticheDto;
import com.daniele.crime_app_backend.exception.RichiestaNonValidaException;
import com.daniele.crime_app_backend.repository.SegnalazioneRepository;
import com.daniele.crime_app_backend.repository.StatisticheRepository;
import com.daniele.crime_app_backend.repository.StatisticheRepository.Ambito;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Statistiche pubbliche (mappa di calore e riepilogo di un'area) e di moderazione (solo admin).
 * Valida i filtri, sceglie dimensione delle celle e ampiezza dei periodi, completa l'andamento
 * con i periodi vuoti; le aggregazioni sono in StatisticheRepository.
 */
@Service
@Transactional(readOnly = true)
public class StatisticheService {

    static final int GIORNI_PREDEFINITI = 30;
    static final int GIORNI_MASSIMI = 731;
    /** Lato minimo della cella (~200 m): le statistiche non devono individuare un indirizzo. */
    static final double CELLA_MINIMA_GRADI = 0.002;
    static final int CELLE_MASSIME = 2000;
    static final int ZONE_CALDE = 5;
    /** Celle che la mappa mostra in larghezza a ogni zoom: lato = 360° / 2^zoom / questo valore. */
    private static final int CELLE_PER_TASSELLO = 8;
    /** Zone calde: riquadro diviso in circa 12 celle per lato. */
    private static final int CELLE_ZONE_CALDE_PER_LATO = 12;

    private final StatisticheRepository statisticheRepository;
    private final SegnalazioneRepository segnalazioneRepository;

    public StatisticheService(StatisticheRepository statisticheRepository,
                              SegnalazioneRepository segnalazioneRepository) {
        this.statisticheRepository = statisticheRepository;
        this.segnalazioneRepository = segnalazioneRepository;
    }

    /** Mappa di calore: celle di lato adatto allo zoom (mai sotto CELLA_MINIMA_GRADI). */
    public List<CellaCaloreDto> mappa(FiltriStatistiche filtri, int zoom) {
        if (zoom < 0 || zoom > 22) {
            throw new RichiestaNonValidaException("Zoom non valido: " + zoom);
        }
        return statisticheRepository.celle(ambito(filtri), latoCella(zoom), CELLE_MASSIME);
    }

    public RiepilogoStatisticheDto riepilogo(FiltriStatistiche filtri) {
        Ambito ambito = ambito(filtri);
        LocalDate dal = ambito.da().toLocalDate();
        LocalDate al = ambito.a().toLocalDate().minusDays(1);
        long giorni = ChronoUnit.DAYS.between(dal, al) + 1;

        long[] totali = statisticheRepository.totali(ambito);
        long precedente = statisticheRepository.totale(ambito,
                ambito.da().minusDays(giorni), ambito.da());
        GranularitaAndamento granularita = granularita(giorni);
        List<PuntoAndamentoDto> andamento = completaAndamento(
                statisticheRepository.andamento(ambito, unitaSql(granularita)), dal, al, granularita);
        double latoZone = Math.max(CELLA_MINIMA_GRADI,
                (ambito.maxLng() - ambito.minLng()) / CELLE_ZONE_CALDE_PER_LATO);

        return new RiepilogoStatisticheDto(dal, al, totali[0], precedente, totali[1], granularita, andamento,
                statisticheRepository.fasce(ambito), statisticheRepository.categorie(ambito),
                statisticheRepository.celle(ambito, latoZone, ZONE_CALDE));
    }

    /** Moderazione nel periodo (solo ADMIN, vedi SecurityConfig): non dipende dall'area. */
    public ModerazioneStatisticheDto moderazione(LocalDate dal, LocalDate al) {
        LocalDate[] periodo = periodo(dal, al);
        LocalDateTime da = periodo[0].atStartOfDay();
        LocalDateTime a = periodo[1].plusDays(1).atStartOfDay();
        return new ModerazioneStatisticheDto(
                statisticheRepository.abusiPerMotivo(da, a),
                statisticheRepository.oreMedieRevisione(da, a),
                statisticheRepository.transizioni(da, a, "RIMOSSA", "ADMIN"),
                statisticheRepository.transizioni(da, a, "SOSPESA", null),
                statisticheRepository.controlliAutomatici(da, a),
                statisticheRepository.nuoviUtenti(da, a),
                segnalazioneRepository.countByDaRivedereTrue());
    }

    // ------------------------------------------------------------------ regole

    static double latoCella(int zoom) {
        return Math.max(CELLA_MINIMA_GRADI, 360.0 / Math.pow(2, zoom) / CELLE_PER_TASSELLO);
    }

    /** Giorni fino a un mese: per giorno; fino a sei mesi: per settimana; oltre: per mese. */
    static GranularitaAndamento granularita(long giorni) {
        if (giorni <= 31) {
            return GranularitaAndamento.GIORNO;
        }
        return giorni <= 186 ? GranularitaAndamento.SETTIMANA : GranularitaAndamento.MESE;
    }

    private static String unitaSql(GranularitaAndamento granularita) {
        return switch (granularita) {
            case GIORNO -> "day";
            case SETTIMANA -> "week";
            case MESE -> "month";
        };
    }

    /** Un punto per ogni periodo tra dal e al, a zero dove il database non ha righe. */
    static List<PuntoAndamentoDto> completaAndamento(Map<LocalDate, Long> conteggi, LocalDate dal, LocalDate al,
                                                     GranularitaAndamento granularita) {
        LocalDate inizio = switch (granularita) {
            case GIORNO -> dal;
            case SETTIMANA -> dal.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case MESE -> dal.withDayOfMonth(1);
        };
        List<PuntoAndamentoDto> punti = new ArrayList<>();
        for (LocalDate p = inizio; !p.isAfter(al); p = switch (granularita) {
            case GIORNO -> p.plusDays(1);
            case SETTIMANA -> p.plusWeeks(1);
            case MESE -> p.plusMonths(1);
        }) {
            punti.add(new PuntoAndamentoDto(p, conteggi.getOrDefault(p, 0L)));
        }
        return punti;
    }

    /** Periodo validato: default ultimi 30 giorni fino a oggi, al massimo 24 mesi, dal ≤ al. */
    static LocalDate[] periodo(LocalDate dal, LocalDate al) {
        LocalDate fine = al != null ? al : LocalDate.now();
        LocalDate inizio = dal != null ? dal : fine.minusDays(GIORNI_PREDEFINITI - 1);
        if (inizio.isAfter(fine)) {
            throw new RichiestaNonValidaException("Il periodo inizia dopo la sua fine");
        }
        if (ChronoUnit.DAYS.between(inizio, fine) + 1 > GIORNI_MASSIMI) {
            throw new RichiestaNonValidaException("Il periodo può coprire al massimo 24 mesi");
        }
        return new LocalDate[] {inizio, fine};
    }

    static Ambito ambito(FiltriStatistiche filtri) {
        LocalDate[] periodo = periodo(filtri.dal(), filtri.al());
        if (filtri.minLat() == null || filtri.minLng() == null || filtri.maxLat() == null || filtri.maxLng() == null) {
            throw new RichiestaNonValidaException("L'area (minLat, minLng, maxLat, maxLng) è obbligatoria");
        }
        if (filtri.minLat() < -90 || filtri.maxLat() > 90 || filtri.minLng() < -180 || filtri.maxLng() > 180
                || filtri.minLat() >= filtri.maxLat() || filtri.minLng() >= filtri.maxLng()) {
            throw new RichiestaNonValidaException("Area non valida");
        }
        if (filtri.gravita() != null && (filtri.gravita() < 1 || filtri.gravita() > 3)) {
            throw new RichiestaNonValidaException("Gravità non valida: " + filtri.gravita());
        }
        return new Ambito(periodo[0].atStartOfDay(), periodo[1].plusDays(1).atStartOfDay(), filtri.gravita(),
                filtri.categoriaId(), filtri.minLat(), filtri.minLng(), filtri.maxLat(), filtri.maxLng());
    }
}
