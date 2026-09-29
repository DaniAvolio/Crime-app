package com.daniele.crime_app_backend.repository;

import com.daniele.crime_app_backend.entity.Categoria;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CategoriaRepository extends JpaRepository<Categoria, Long>, JpaSpecificationExecutor<Categoria> {

    Optional<Categoria> findByNome(String nome);

    List<Categoria> findByAttivaTrue(Sort ordinamento);

    /** True se un'altra categoria (diversa da idEscluso, se valorizzato) usa già quel nome in quella lingua. */
    @Query("""
            select count(c) > 0 from Categoria c join c.traduzioni t
            where key(t) = :lingua and t.nome = :nome
              and (:idEscluso is null or c.id <> :idEscluso)
            """)
    boolean esisteTraduzione(@Param("lingua") String lingua, @Param("nome") String nome,
                             @Param("idEscluso") Long idEscluso);
}
