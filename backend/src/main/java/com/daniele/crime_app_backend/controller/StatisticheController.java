package com.daniele.crime_app_backend.controller;

import com.daniele.crime_app_backend.dto.CellaCaloreDto;
import com.daniele.crime_app_backend.dto.FiltriStatistiche;
import com.daniele.crime_app_backend.dto.ModerazioneStatisticheDto;
import com.daniele.crime_app_backend.dto.RiepilogoStatisticheDto;
import com.daniele.crime_app_backend.service.StatisticheService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/** Statistiche: mappa e riepilogo pubblici, moderazione solo ADMIN (vedi SecurityConfig). */
@RestController
@RequestMapping("/api/statistiche")
public class StatisticheController {

    private final StatisticheService statisticheService;

    public StatisticheController(StatisticheService statisticheService) {
        this.statisticheService = statisticheService;
    }

    @GetMapping("/mappa")
    public List<CellaCaloreDto> mappa(FiltriStatistiche filtri, @RequestParam int zoom) {
        return statisticheService.mappa(filtri, zoom);
    }

    @GetMapping("/riepilogo")
    public RiepilogoStatisticheDto riepilogo(FiltriStatistiche filtri) {
        return statisticheService.riepilogo(filtri);
    }

    @GetMapping("/moderazione")
    public ModerazioneStatisticheDto moderazione(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate al) {
        return statisticheService.moderazione(dal, al);
    }
}
