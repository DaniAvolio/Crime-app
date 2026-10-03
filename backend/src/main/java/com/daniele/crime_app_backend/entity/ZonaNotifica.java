package com.daniele.crime_app_backend.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.locationtech.jts.geom.Point;

import java.time.LocalDateTime;

/**
 * Zona in cui un utente vuole essere avvisato delle nuove segnalazioni (es. "Casa", "Lavoro"):
 * un punto e un raggio. Al massimo ZoneNotificaService.ZONE_MASSIME per utente.
 */
@Entity
@Table(name = "zona_notifica")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = "utente")
public class ZonaNotifica {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "utente_id", nullable = false)
    private Utente utente;

    @NotBlank
    @Column(nullable = false, length = 40)
    private String nome;

    @NotNull
    @Column(nullable = false, columnDefinition = "geography(Point,4326)")
    private Point posizione;

    @Column(name = "raggio_metri", nullable = false)
    private int raggioMetri;

    @CreationTimestamp
    @Column(name = "data_creazione", nullable = false, updatable = false)
    private LocalDateTime dataCreazione;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ZonaNotifica that)) return false;
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
