package com.daniele.crime_app_backend.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Utente registrato. La registrazione richiede identità verificata; l'anonimato
 * riguarda solo la visualizzazione delle segnalazioni (il campo autore non è
 * mai null, vedi Segnalazione).
 */
@Entity
@Table(name = "utente", indexes = {
        @Index(name = "idx_utente_email", columnList = "email", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = {"segnalazioni", "deviceTokens", "preferenzeNotifica"})
public class Utente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(nullable = false, length = 100)
    private String nome;

    @NotBlank
    @Column(nullable = false, length = 100)
    private String cognome;

    @Email
    @NotBlank
    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @NotBlank
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    /**
     * Identità verificata in fase di registrazione (es. SPID/CIE, documento,
     * conferma email+telefono a seconda della strategia scelta a monte).
     */
    @Column(name = "identita_verificata", nullable = false)
    @Builder.Default
    private boolean identitaVerificata = false;

    /** Punteggio di fiducia (soft trust scoring). */
    @Column(name = "punteggio_fiducia", nullable = false)
    @Builder.Default
    private Integer punteggioFiducia = 100;

    @Column(nullable = false)
    @Builder.Default
    private boolean attivo = true;

    @CreationTimestamp
    @Column(name = "data_registrazione", nullable = false, updatable = false)
    private LocalDateTime dataRegistrazione;

    @UpdateTimestamp
    @Column(name = "data_aggiornamento")
    private LocalDateTime dataAggiornamento;

    @OneToMany(mappedBy = "autore", cascade = CascadeType.ALL)
    @Builder.Default
    private List<Segnalazione> segnalazioni = new ArrayList<>();

    @OneToMany(mappedBy = "utente", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<DeviceToken> deviceTokens = new ArrayList<>();

    @OneToOne(mappedBy = "utente", cascade = CascadeType.ALL, orphanRemoval = true)
    private PreferenzeNotifica preferenzeNotifica;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Utente utente)) return false;
        return id != null && id.equals(utente.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
