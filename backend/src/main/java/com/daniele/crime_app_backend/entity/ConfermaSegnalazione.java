package com.daniele.crime_app_backend.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Risposta di un utente alla domanda "è ancora in atto?" su una Segnalazione.
 * Un voto per utente per Segnalazione (vincolo di unicità), modificabile: un
 * "sì" prolunga la scadenza, un numero sufficiente di "no" successivi all'ultimo
 * "sì" porta la Segnalazione in SCADUTA (vedi ConfermaSegnalazioneService).
 */
@Entity
@Table(name = "conferma_segnalazione", indexes = {
        @Index(name = "idx_conferma_segnalazione_segnalazione", columnList = "segnalazione_id")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_conferma_segnalazione_utente", columnNames = {"segnalazione_id", "utente_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = {"segnalazione", "utente"})
public class ConfermaSegnalazione {

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

    @Column(name = "ancora_in_atto", nullable = false)
    private boolean ancoraInAtto;

    /** Non è un @CreationTimestamp: va aggiornata quando l'utente cambia voto. */
    @NotNull
    @Column(name = "data_voto", nullable = false)
    private LocalDateTime dataVoto;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ConfermaSegnalazione that)) return false;
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
