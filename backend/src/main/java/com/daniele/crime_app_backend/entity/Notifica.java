package com.daniele.crime_app_backend.entity;

import com.daniele.crime_app_backend.entity.enums.TipoNotifica;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Avviso ricevuto da un utente (campanella e, se le preferenze lo consentono, push).
 * Il testo non si salva: il client lo compone nella lingua attiva da tipo, segnalazione e zona.
 */
@Entity
@Table(name = "notifica")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = {"utente", "segnalazione"})
public class Notifica {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "utente_id", nullable = false)
    private Utente utente;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TipoNotifica tipo;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "segnalazione_id", nullable = false)
    private Segnalazione segnalazione;

    /** Nome della zona in cui è caduta la segnalazione (solo per VICINA). */
    @Column(name = "zona_nome", length = 40)
    private String zonaNome;

    @CreationTimestamp
    @Column(name = "data_creazione", nullable = false, updatable = false)
    private LocalDateTime dataCreazione;

    @Column(nullable = false)
    private boolean letta;

    /** Inviata come push vera (non solo in app né come riepilogo): conta per il limite orario. */
    @Column(name = "inviata_push", nullable = false)
    private boolean inviataPush;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Notifica that)) return false;
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
