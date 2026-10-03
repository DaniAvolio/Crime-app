package com.daniele.crime_app_backend.entity;

import com.daniele.crime_app_backend.entity.enums.Piattaforma;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Sottoscrizione Web Push di un dispositivo (browser o app installata): token = endpoint del
 * servizio push del browser, p256dh e auth = chiavi per cifrare il contenuto (RFC 8291).
 * Una per dispositivo; quelle scadute (404/410 dal servizio push) vengono cancellate.
 */
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
    @Column(nullable = false, unique = true, length = 1000)
    private String token;

    /** Chiave pubblica ECDH P-256 del browser (base64url, punto non compresso). */
    @NotBlank
    @Column(nullable = false, length = 200)
    private String p256dh;

    /** Segreto di autenticazione del browser (base64url, 16 byte). */
    @NotBlank
    @Column(nullable = false, length = 100)
    private String auth;

    /** Lingua del dispositivo all'iscrizione: le push si scrivono in questa lingua. */
    @NotBlank
    @Column(nullable = false, length = 10)
    @Builder.Default
    private String lingua = "it";

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
