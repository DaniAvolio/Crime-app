package com.daniele.crime_app_backend.service.moderazione;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Usa le liste vere (classpath:moderazione/*.txt), così i test coprono anche i file. */
class ValidatoreDescrizioneTest {

    private final ValidatoreDescrizione validatore = new ValidatoreDescrizione();

    private List<TipoViolazione> bloccanti(String testo) {
        return validatore.valida(testo).bloccanti().stream().map(Violazione::tipo).toList();
    }

    private List<String> frammenti(String testo) {
        return validatore.valida(testo).bloccanti().stream().map(Violazione::frammento).toList();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "Auto in sosta vietata davanti al passo carraio di via Roma 12",
            "Rissa tra due ragazzi alle 22.30 vicino alla fermata del bus 4",
            "Furto in un negozio il 12/03/2026 verso le ore 18:45",
            "Rumore molto forte dal locale, musica alta fino alle 2 di notte",
            "Un uomo romano anziano è caduto, servono soccorsi",
            "Auto con targa straniera parcheggiata sul marciapiede da giorni",
            "Lite violenta in piazza, un uomo con giacca rossa e cappello nero",
            "Ristorante cinese con i rifiuti lasciati in strada",
            "Incidente al km 12.500 della tangenziale, coda di 100 km",
            "Aggressione il 12-03-2026 10.30 davanti alla scuola",
    })
    void testiNormaliPassano(String testo) {
        ValidatoreDescrizione.Esito esito = validatore.valida(testo);
        assertThat(esito.bloccanti()).isEmpty();
        assertThat(esito.soft()).isEmpty();
    }

    @Test
    void troppoCorta() {
        assertThat(bloccanti("  furto  ")).containsExactly(TipoViolazione.TROPPO_CORTA);
    }

    @Test
    void datiPersonaliConIlFrammento() {
        assertThat(frammenti("Chiamate il 333 123 4567 per info")).containsExactly("333 123 4567");
        assertThat(frammenti("Numero +39 011.123.4567 del condominio")).containsExactly("+39 011.123.4567");
        assertThat(frammenti("Scrivete a mario.rossi@example.com subito")).containsExactly("mario.rossi@example.com");
        assertThat(frammenti("La macchina targata AB 123 CD è sempre qui")).containsExactly("AB 123 CD");
        assertThat(frammenti("La macchina targata ab123cd è sempre qui")).containsExactly("ab123cd");
        assertThat(bloccanti("Chiamate il 3331234567 per info")).containsExactly(TipoViolazione.DATI_PERSONALI);
    }

    @Test
    void link() {
        assertThat(bloccanti("Guardate il video su www.esempio.it ora")).containsExactly(TipoViolazione.LINK);
        assertThat(bloccanti("Tutto qui https://example.com/video?x=1 guardate"))
                .containsExactly(TipoViolazione.LINK);
        assertThat(bloccanti("Info su sitoqualsiasi.com e basta")).containsExactly(TipoViolazione.LINK);
    }

    @Test
    void linguaggioOffensivoAncheMascherato() {
        assertThat(bloccanti("Il vicino è uno stronzo e fa casino")).containsExactly(TipoViolazione.LINGUAGGIO_OFFENSIVO);
        assertThat(bloccanti("Il vicino è uno STR0NZOOO e fa casino"))
                .containsExactly(TipoViolazione.LINGUAGGIO_OFFENSIVO);
        assertThat(bloccanti("Che cazzzzo di rumore stanotte"))
                .containsExactly(TipoViolazione.LINGUAGGIO_OFFENSIVO);
        assertThat(bloccanti("Porco   dio che rumore stanotte"))
                .containsExactly(TipoViolazione.LINGUAGGIO_OFFENSIVO);
        assertThat(bloccanti("This guy is an asshole, stop him")).containsExactly(TipoViolazione.LINGUAGGIO_OFFENSIVO);
    }

    @Test
    void riferimentiDiscriminatori() {
        assertThat(frammenti("2 magrebini che stanno spacciando")).containsExactly("magrebini");
        assertThat(bloccanti("Gruppo di zingare che chiede soldi")).containsExactly(TipoViolazione.DISCRIMINAZIONE);
        assertThat(bloccanti("Campo rom abusivo vicino al fiume")).containsExactly(TipoViolazione.DISCRIMINAZIONE);
        assertThat(bloccanti("Some immigrants selling drugs here")).containsExactly(TipoViolazione.DISCRIMINAZIONE);
    }

    @Test
    void maiuscoleERipetizioniSonoSoftENonBloccano() {
        ValidatoreDescrizione.Esito maiuscole = validatore.valida("AUTO IN SOSTA VIETATA DAVANTI AL PASSO CARRAIO");
        assertThat(maiuscole.pubblicabile()).isTrue();
        assertThat(maiuscole.soft()).containsExactly(TipoViolazione.MAIUSCOLE);

        assertThat(validatore.valida("Rumore fortissimooooooo dal locale").soft())
                .containsExactly(TipoViolazione.RIPETIZIONI);
        assertThat(validatore.valida("Aiuto aiuto aiuto aiuto, rissa in piazza").soft())
                .containsExactly(TipoViolazione.RIPETIZIONI);
    }

    @Test
    void piuViolazioniInsieme() {
        assertThat(bloccanti("Lo stronzo del 333 1234567"))
                .containsExactlyInAnyOrder(TipoViolazione.DATI_PERSONALI, TipoViolazione.LINGUAGGIO_OFFENSIVO);
    }
}
