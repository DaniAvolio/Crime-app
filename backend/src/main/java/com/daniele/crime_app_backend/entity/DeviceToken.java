package com.daniele.crime_app_backend.entity;

import com.daniele.crime_app_backend.entity.enums.Piattaforma;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/** Token del dispositivo per l'invio di notifiche push (FCM/APNs/Web Push). */
@Entity
@Table(name = "device_token", indexes = {
        @Index(name = "idx_device_token_utente", columnList = "utente_id")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_device_token_token", columnNames = "token")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = "utente")
public class DeviceToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "utente_id", nullable = false)
    private Utente utente;

    @NotBlank
    @Column(nullable = false, unique = true, length = 500)
    private String token;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Piattaforma piattaforma;

    @CreationTimestamp
    @Column(name = "data_registrazione", nullable = false, updatable = false)
    private LocalDateTime dataRegistrazione;

    @Column(name = "ultimo_utilizzo")
    private LocalDateTime ultimoUtilizzo;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof DeviceToken that)) return false;
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
