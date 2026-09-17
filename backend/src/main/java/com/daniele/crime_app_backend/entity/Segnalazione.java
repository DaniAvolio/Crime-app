package com.daniele.crime_app_backend.entity;

import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.locationtech.jts.geom.Point;

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
 * scadenza per categoria) | ATTIVA -> SOSPESA (soglia abusi raggiunta,
 * automatico) | ATTIVA -> RIMOSSA (admin o autore) | SOSPESA -> ATTIVA|RIMOSSA
 * (solo admin).
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
     * Autore reale della segnalazione. Non è mai null: l'anonimato è gestito
     * solo a livello di visualizzazione tramite il campo "anonima".
     */
    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "autore_id", nullable = false)
    private Utente autore;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "categoria_id", nullable = false)
    private Categoria categoria;

    @NotBlank
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

    /** Calcolata alla creazione da Categoria.durataValiditaOre. */
    @NotNull
    @Column(name = "data_scadenza", nullable = false)
    private LocalDateTime dataScadenza;

    @Column(name = "data_rimozione")
    private LocalDateTime dataRimozione;

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
