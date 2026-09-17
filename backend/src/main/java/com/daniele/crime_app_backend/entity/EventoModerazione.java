package com.daniele.crime_app_backend.entity;

import com.daniele.crime_app_backend.entity.enums.StatoSegnalazione;
import com.daniele.crime_app_backend.entity.enums.TipoAttoreModerazione;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Audit trail di ogni transizione di stato di una Segnalazione, sia automatica
 * (job di scadenza, soglia abusi, filtro testo) sia manuale (decisione admin
 * o rimozione da parte dell'autore).
 */
@Entity
@Table(name = "evento_moderazione", indexes = {
        @Index(name = "idx_evento_moderazione_segnalazione", columnList = "segnalazione_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = {"segnalazione", "amministratore"})
public class EventoModerazione {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "segnalazione_id", nullable = false)
    private Segnalazione segnalazione;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "stato_precedente", nullable = false, length = 20)
    private StatoSegnalazione statoPrecedente;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "stato_nuovo", nullable = false, length = 20)
    private StatoSegnalazione statoNuovo;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_attore", nullable = false, length = 20)
    private TipoAttoreModerazione tipoAttore;

    /** Null se la transizione è automatica (job/sistema). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "amministratore_id")
    private Utente amministratore;

    @Column(length = 500)
    private String motivazione;

    @CreationTimestamp
    @Column(name = "data_evento", nullable = false, updatable = false)
    private LocalDateTime dataEvento;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof EventoModerazione that)) return false;
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
