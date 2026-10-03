package com.daniele.crime_app_backend.entity;

import com.daniele.crime_app_backend.entity.enums.EsitoAbuso;
import com.daniele.crime_app_backend.entity.enums.MotivoAbuso;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Segnalazione di abuso ("Segnala un problema") da parte della community su una Segnalazione.
 * Un utente può segnalare abuso una sola volta per Segnalazione (vincolo di unicità). Ogni abuso
 * pesa secondo la fiducia del segnalante; quando la somma dei pesi in attesa raggiunge la soglia
 * la Segnalazione passa in SOSPESA (vedi SegnalazioneAbusoService). L'admin decide l'esito.
 */
@Entity
@Table(name = "segnalazione_abuso", indexes = {
        @Index(name = "idx_segnalazione_abuso_segnalazione", columnList = "segnalazione_id")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_abuso_segnalazione_utente", columnNames = {"segnalazione_id", "utente_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = {"segnalazione", "utente"})
public class SegnalazioneAbuso {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "segnalazione_id", nullable = false)
    private Segnalazione segnalazione;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "utente_id", nullable = false)
    private Utente utente;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private MotivoAbuso motivo;

    /** Dettaglio facoltativo scritto dal segnalante. */
    @Column(length = 300)
    private String nota;

    /** Peso al momento dell'invio: fiducia del segnalante / 100, minimo 0.25. */
    @NotNull
    @Column(nullable = false, precision = 4, scale = 2)
    private BigDecimal peso;

    /** Decisione dell'admin; null finché è in attesa. */
    @Enumerated(EnumType.STRING)
    @Column(length = 12)
    private EsitoAbuso esito;

    /** Quando l'admin ha deciso (statistiche: tempo medio di revisione). */
    @Column(name = "data_esito")
    private LocalDateTime dataEsito;

    @CreationTimestamp
    @Column(name = "data_segnalazione", nullable = false, updatable = false)
    private LocalDateTime dataSegnalazione;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof SegnalazioneAbuso that)) return false;
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
