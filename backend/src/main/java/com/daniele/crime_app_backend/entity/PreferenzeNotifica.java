package com.daniele.crime_app_backend.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.*;

/** Preferenze di notifica push dell'utente. Raggio configurabile dall'utente. */
@Entity
@Table(name = "preferenze_notifica")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = "utente")
public class PreferenzeNotifica {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "utente_id", nullable = false, unique = true)
    private Utente utente;

    /** Raggio di notifica in metri. */
    @NotNull
    @Positive
    @Column(name = "raggio_notifica_metri", nullable = false)
    @Builder.Default
    private Integer raggioNotificaMetri = 1000;

    @Column(name = "notifiche_attive", nullable = false)
    @Builder.Default
    private boolean notificheAttive = true;

    @Column(name = "notifiche_solo_categorie_preferite", nullable = false)
    @Builder.Default
    private boolean notificheSoloCategoriePreferite = false;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof PreferenzeNotifica that)) return false;
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
