package com.daniele.crime_app_backend.service.notifiche;

import com.daniele.crime_app_backend.entity.enums.TipoNotifica;

import java.util.Map;

/**
 * Testi delle push, nella lingua del dispositivo (it come riserva). Nell'app il testo degli
 * avvisi lo compone il client dai file i18n: qui servono solo per le notifiche di sistema, che
 * il browser mostra senza aprire l'app. Segnaposto: {categoria}, {zona}, {numero}.
 */
final class MessaggiNotifica {

    record Testo(String titolo, String corpo) {}

    private static final Map<String, Map<TipoNotifica, Testo>> PER_LINGUA = Map.of(
            "it", Map.of(
                    TipoNotifica.VICINA, new Testo("{categoria} vicino a {zona}", "{descrizione}"),
                    TipoNotifica.CONFERMATA, new Testo("La tua segnalazione è stata confermata",
                            "{categoria}: un altro utente conferma che è ancora in atto."),
                    TipoNotifica.CHIUSA, new Testo("La tua segnalazione è stata chiusa",
                            "{categoria}: diversi utenti indicano che non è più in atto."),
                    TipoNotifica.RIMOSSA, new Testo("La tua segnalazione è stata rimossa",
                            "{categoria}: rimossa da un amministratore."),
                    TipoNotifica.SOSPESA, new Testo("La tua segnalazione è in revisione",
                            "{categoria}: sospesa dopo alcune segnalazioni di problemi; un amministratore la controllerà.")),
            "en", Map.of(
                    TipoNotifica.VICINA, new Testo("{categoria} near {zona}", "{descrizione}"),
                    TipoNotifica.CONFERMATA, new Testo("Your report was confirmed",
                            "{categoria}: another user confirms it is still happening."),
                    TipoNotifica.CHIUSA, new Testo("Your report was closed",
                            "{categoria}: several users say it is no longer happening."),
                    TipoNotifica.RIMOSSA, new Testo("Your report was removed",
                            "{categoria}: removed by an administrator."),
                    TipoNotifica.SOSPESA, new Testo("Your report is under review",
                            "{categoria}: suspended after some problem reports; an administrator will check it.")));

    private static final Map<String, Testo> RIEPILOGO = Map.of(
            "it", new Testo("Altre {numero} segnalazioni nelle tue zone", "Apri Crime per vederle."),
            "en", new Testo("{numero} more reports in your areas", "Open Crime to see them."));

    private MessaggiNotifica() {
    }

    static String linguaSupportata(String lingua) {
        String breve = lingua == null ? "it" : lingua.toLowerCase().split("[-_]")[0];
        return PER_LINGUA.containsKey(breve) ? breve : "it";
    }

    static Testo per(TipoNotifica tipo, String lingua, String categoria, String zona, String descrizione) {
        Testo t = PER_LINGUA.get(linguaSupportata(lingua)).get(tipo);
        return new Testo(sostituisci(t.titolo(), categoria, zona, descrizione),
                sostituisci(t.corpo(), categoria, zona, descrizione));
    }

    static Testo riepilogo(String lingua, long numero) {
        Testo t = RIEPILOGO.get(linguaSupportata(lingua));
        return new Testo(t.titolo().replace("{numero}", String.valueOf(numero)), t.corpo());
    }

    private static String sostituisci(String modello, String categoria, String zona, String descrizione) {
        return modello.replace("{categoria}", categoria)
                .replace("{zona}", zona == null ? "" : zona)
                .replace("{descrizione}", accorcia(descrizione == null ? "" : descrizione, 140));
    }

    private static String accorcia(String testo, int massimo) {
        String pulito = testo.strip().replaceAll("\\s+", " ");
        return pulito.length() <= massimo ? pulito : pulito.substring(0, massimo - 1).strip() + "…";
    }
}
