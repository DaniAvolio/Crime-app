package com.daniele.crime_app_backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

/** Nome e descrizione di una Categoria in una lingua diversa dall'italiano. */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
@ToString
public class TraduzioneCategoria {

    @Column(nullable = false, length = 100)
    private String nome;

    @Column(length = 500)
    private String descrizione;
}
