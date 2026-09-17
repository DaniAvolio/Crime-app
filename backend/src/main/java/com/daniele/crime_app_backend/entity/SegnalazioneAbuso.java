package com.daniele.crime_app_backend.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Segnalazione di abuso da parte della community su una Segnalazione.
 * Un utente può segnalare abuso una sola volta per Segnalazione (vincolo di
 * unicità). Il superamento della soglia di abusi porta automaticamente la
 * Segnalazione in stato SOSPESA.
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

    @NotBlank
    @Column(nullable = false, length = 500)
    private String motivo;

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
