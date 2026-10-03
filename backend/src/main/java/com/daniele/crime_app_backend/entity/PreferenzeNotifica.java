package com.daniele.crime_app_backend.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalTime;
import java.util.HashSet;
import java.util.Set;

/**
 * Preferenze delle notifiche di un utente. Senza riga valgono i default di questa classe (vedi
 * PreferenzeNotificaService): avvisi attivi, solo gravità alta, tutte le categorie, nessun silenzio.
 * Le zone in cui ricevere gli avvisi sono in ZonaNotifica.
 */
@Entity
@Table(name = "preferenze_notifica")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = {"utente", "categorie"})
public class PreferenzeNotifica {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "utente_id", nullable = false, unique = true)
    private Utente utente;

    /** Interruttore generale: spento, nessun avviso (né in app né push). */
    @Column(name = "notifiche_attive", nullable = false)
    @Builder.Default
    private boolean notificheAttive = true;

    /** Gravità minima delle segnalazioni vicine da notificare (1–3). */
    @Column(name = "gravita_minima", nullable = false)
    @Builder.Default
    private int gravitaMinima = 3;

    /** Categorie scelte; vuoto = tutte quelle con gravità sufficiente. */
    @ManyToMany
    @JoinTable(name = "preferenze_notifica_categoria",
            joinColumns = @JoinColumn(name = "preferenze_id"),
            inverseJoinColumns = @JoinColumn(name = "categoria_id"))
    @Builder.Default
    private Set<Categoria> categorie = new HashSet<>();

    /** Ore di silenzio (ora italiana), anche a cavallo della mezzanotte; null = nessuna. */
    @Column(name = "ore_silenzio_da")
    private LocalTime oreSilenzioDa;

    @Column(name = "ore_silenzio_a")
    private LocalTime oreSilenzioA;

    /** Durante il silenzio le segnalazioni di gravità alta arrivano comunque come push. */
    @Column(name = "gravi_in_silenzio", nullable = false)
    @Builder.Default
    private boolean graviInSilenzio = true;

    /** Avvisi sulle proprie segnalazioni (confermata, chiusa, rimossa, sospesa). */
    @Column(name = "aggiornamenti_mie", nullable = false)
    @Builder.Default
    private boolean aggiornamentiMie = true;

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
