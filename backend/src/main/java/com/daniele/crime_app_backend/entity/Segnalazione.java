package com.daniele.crime_app_backend.entity;

import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.locationtech.jts.geom.Point;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Segnalazione di un evento osservabile legato alla sicurezza pubblica.
 * <p>
 * Lo schema (inclusi indici, indice GIST su "posizione" ed estensione PostGIS)
 * è gestito da Flyway, vedi db/migration/V1__init_schema.sql.
 * <p>
 * Macchina a stati (vedi StatoSegnalazione): ATTIVA -> SCADUTA (job schedulato,
 * scadenza per categoria, oppure soglia di voti "non più in atto" raggiunta,
 * vedi ConfermaSegnalazione) | ATTIVA -> SOSPESA (soglia abusi raggiunta,
 * automatico) | ATTIVA -> RIMOSSA (admin o autore) | SOSPESA -> ATTIVA|RIMOSSA
 * (solo admin).
 * <p>
 * Storico: 12 mesi dopo la chiusura (SCADUTA o RIMOSSA) la segnalazione viene anonimizzata
 * (autore null, descrizione vuota, posizione arrotondata), vedi SegnalazioneAnonimizzazioneJob.
 */
@Entity
@Table(name = "segnalazione", indexes = {
        @Index(name = "idx_segnalazione_stato", columnList = "stato"),
        @Index(name = "idx_segnalazione_data_scadenza", columnList = "data_scadenza")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = {"autore", "categoria", "segnalazioniAbuso", "eventiModerazione"})
public class Segnalazione {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Autore reale della segnalazione. Null solo dopo l'anonimizzazione dello storico
     * (dataAnonimizzazione valorizzata): finché la segnalazione è recente l'anonimato è gestito
     * solo a livello di visualizzazione tramite il campo "anonima".
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "autore_id")
    private Utente autore;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "categoria_id", nullable = false)
    private Categoria categoria;

    /** Obbligatoria alla creazione (SegnalazioneRequest); vuota dopo l'anonimizzazione. */
    @NotNull
    @Column(nullable = false, length = 2000)
    private String descrizione;

    @NotNull
    @Column(nullable = false, columnDefinition = "geography(Point,4326)")
    private Point posizione;

    @Column(nullable = false)
    @Builder.Default
    private boolean anonima = false;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private StatoSegnalazione stato = StatoSegnalazione.ATTIVA;

    @CreationTimestamp
    @Column(name = "data_creazione", nullable = false, updatable = false)
    private LocalDateTime dataCreazione;

    /**
     * Calcolata alla creazione da Categoria.durataValiditaOre, prolungata a ogni
     * conferma "ancora in atto" (vedi ConfermaSegnalazioneService).
     */
    @NotNull
    @Column(name = "data_scadenza", nullable = false)
    private LocalDateTime dataScadenza;

    @Column(name = "data_rimozione")
    private LocalDateTime dataRimozione;

    /** Ultima conferma "ancora in atto": i voti "non più in atto" contano solo se successivi. */
    @Column(name = "data_ultima_conferma")
    private LocalDateTime dataUltimaConferma;

    /*
     * Coda di moderazione. Le colonne si aggiornano solo con update atomici in
     * SegnalazioneRepository (registraAbuso, chiudiRevisione), mai dall'entità: per questo sono
     * updatable = false, così salvare la segnalazione (es. un cambio di stato) non le sovrascrive.
     */

    /** Abusi in attesa di una decisione dell'admin. */
    @Column(name = "numero_abusi", nullable = false, updatable = false)
    @Builder.Default
    private int numeroAbusi = 0;

    /** Somma dei pesi degli abusi in attesa: alla soglia la segnalazione viene sospesa. */
    @Column(name = "peso_abusi", nullable = false, updatable = false, precision = 6, scale = 2)
    @Builder.Default
    private BigDecimal pesoAbusi = BigDecimal.ZERO;

    /** In coda per l'admin: abusi in attesa o controlli automatici sulla descrizione scattati. */
    @Column(name = "da_rivedere", nullable = false, updatable = false)
    @Builder.Default
    private boolean daRivedere = false;

    /** Codici dei controlli soft scattati alla creazione (es. "MAIUSCOLE,RIPETIZIONI"). */
    @Column(name = "revisione_automatica", length = 100, updatable = false)
    private String revisioneAutomatica;

    /** Quando è stata anonimizzata (storico oltre i 12 mesi); null finché non lo è. */
    @Column(name = "data_anonimizzazione")
    private LocalDateTime dataAnonimizzazione;

    @OneToMany(mappedBy = "segnalazione", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<SegnalazioneAbuso> segnalazioniAbuso = new ArrayList<>();

    @OneToMany(mappedBy = "segnalazione", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<EventoModerazione> eventiModerazione = new ArrayList<>();

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Segnalazione that)) return false;
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
