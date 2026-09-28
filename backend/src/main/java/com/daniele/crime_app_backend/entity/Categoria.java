package com.daniele.crime_app_backend.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.*;

/**
 * Categoria di segnalazione: tabella su DB (non enum) per permettere agli
 * admin di configurare la tassonomia senza redeploy. Limitata a comportamenti
 * osservabili, mai etichette riferite a persone.
 */
@Entity
@Table(name = "categoria")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
public class Categoria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(nullable = false, unique = true, length = 100)
    private String nome;

    @Column(length = 500)
    private String descrizione;

    /** Nome icona / codice colore per la UI. */
    @Column(length = 50)
    private String icona;

    /**
     * Durata di validità in ore prima della scadenza automatica delle
     * segnalazioni di questa categoria (la scadenza è variabile per categoria).
     */
    @NotNull
    @Positive
    @Column(name = "durata_validita_ore", nullable = false)
    private Integer durataValiditaOre;

    /**
     * Gravità da 1 (degrado, quiete) a 3 (contro la persona): decide il colore
     * dei marker e permette all'utente di filtrare la mappa.
     */
    @NotNull
    @Min(1)
    @Max(3)
    @Column(nullable = false)
    @Builder.Default
    private Integer gravita = 1;

    @Column(nullable = false)
    @Builder.Default
    private boolean attiva = true;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Categoria categoria)) return false;
        return id != null && id.equals(categoria.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
