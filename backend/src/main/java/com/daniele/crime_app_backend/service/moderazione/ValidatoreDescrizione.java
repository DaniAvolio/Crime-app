package com.daniele.crime_app_backend.service.moderazione;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Controlli deterministici sulla descrizione di una segnalazione, prima della pubblicazione.
 * <ul>
 *   <li>Bloccanti: troppo corta, dati personali (telefoni, email, targhe), link, linguaggio
 *   offensivo, riferimenti discriminatori (origine, etnia, religione).</li>
 *   <li>Soft: testo quasi tutto maiuscolo, ripetizioni. Si pubblica, ma l'admin rivede.</li>
 * </ul>
 * Le parole vengono da {@code classpath:moderazione/<lingua>.txt} (sezioni {@code [offensivo]} e
 * {@code [discriminazione]}); tutte le lingue si applicano a ogni testo, così aggiungere una lingua
 * significa aggiungere un file. Una voce che finisce con {@code *} vale anche per le parole che
 * iniziano così (es. {@code magrebin*} → magrebino, magrebini, magrebina); le voci di più parole
 * sono frasi. Il confronto avviene su un testo normalizzato: minuscole, senza accenti, con il
 * leetspeak più comune tradotto (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s) e le lettere ripetute
 * compattate (stronzooo → stronzo).
 */
@Slf4j
@Component
public class ValidatoreDescrizione {

    static final int LUNGHEZZA_MINIMA = 10;

    private static final Pattern EMAIL = Pattern.compile("[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+");
    private static final Pattern LINK = Pattern.compile(
            "(?i)\\b(https?://\\S+|www\\.\\S+|[a-z0-9-]+\\.(it|com|net|org|eu|info|io|me|ly)(/\\S*)?)\\b");
    /** Sequenze di cifre separate al più da spazi, punti o trattini (non "/" né ":", per date e ore). */
    private static final Pattern NUMERO = Pattern.compile("(?<![\\w])\\+?\\d[\\d .\\-]{6,}\\d(?![\\w])");
    private static final int CIFRE_MINIME_TELEFONO = 9;
    /** Date (12.03.2026, 12-03-26) e ore (22.30): una sequenza che le contiene non è un telefono. */
    private static final Pattern DATA_O_ORA = Pattern.compile(
            "\\b\\d{1,2}[.\\-]\\d{1,2}([.\\-]\\d{2,4})?\\b");
    /** Targhe italiane: AB 123 CD in maiuscolo (anche con spazi) o ab123cd attaccato. */
    private static final Pattern TARGA = Pattern.compile(
            "\\b([A-Z]{2}\\s?\\d{3}\\s?[A-Z]{2}|(?i:[a-z]{2}\\d{3}[a-z]{2}))\\b");
    private static final Pattern CARATTERE_RIPETUTO = Pattern.compile("(\\S)\\1{5,}");
    private static final Pattern PAROLA_RIPETUTA = Pattern.compile(
            "(?iu)\\b(\\p{L}{2,})(\\s+\\1\\b){3,}");
    private static final int LETTERE_MINIME_MAIUSCOLE = 20;
    private static final double QUOTA_MAIUSCOLE = 0.7;

    private final Map<TipoViolazione, Pattern> parole;

    public ValidatoreDescrizione() {
        this(caricaListe());
    }

    /** Per i test: liste già lette, per sezione. */
    ValidatoreDescrizione(Map<TipoViolazione, List<String>> liste) {
        this.parole = new EnumMap<>(TipoViolazione.class);
        liste.forEach((tipo, voci) -> {
            if (!voci.isEmpty()) {
                parole.put(tipo, compila(voci));
            }
        });
    }

    /** Esito dei controlli: le violazioni bloccanti e i codici dei controlli soft scattati. */
    public record Esito(List<Violazione> bloccanti, List<TipoViolazione> soft) {
        public boolean pubblicabile() {
            return bloccanti.isEmpty();
        }
    }

    public Esito valida(String descrizione) {
        String testo = descrizione == null ? "" : descrizione.strip();
        List<Violazione> bloccanti = new ArrayList<>();
        List<TipoViolazione> soft = new ArrayList<>();

        if (testo.length() < LUNGHEZZA_MINIMA) {
            bloccanti.add(new Violazione(TipoViolazione.TROPPO_CORTA, testo));
        }
        trovaTutti(EMAIL, testo).forEach(f -> bloccanti.add(new Violazione(TipoViolazione.DATI_PERSONALI, f)));
        // Le email contengono un dominio: non contarle anche come link.
        String senzaEmail = EMAIL.matcher(testo).replaceAll(" ");
        trovaTutti(LINK, senzaEmail).forEach(f -> bloccanti.add(new Violazione(TipoViolazione.LINK, f)));
        trovaTutti(NUMERO, testo).stream()
                .filter(f -> f.chars().filter(Character::isDigit).count() >= CIFRE_MINIME_TELEFONO)
                .filter(f -> !DATA_O_ORA.matcher(f).find())
                .forEach(f -> bloccanti.add(new Violazione(TipoViolazione.DATI_PERSONALI, f)));
        trovaTutti(TARGA, testo).forEach(f -> bloccanti.add(new Violazione(TipoViolazione.DATI_PERSONALI, f)));

        Set<String> normalizzati = normalizza(testo);
        // Vale la prima variante normalizzata che trova qualcosa: le altre darebbero gli stessi
        // termini scritti diversamente ("stronzoo" e "stronzo").
        parole.forEach((tipo, modello) -> normalizzati.stream()
                .map(n -> trovaTutti(modello, n))
                .filter(trovate -> !trovate.isEmpty())
                .findFirst()
                .ifPresent(trovate -> trovate.forEach(f -> bloccanti.add(new Violazione(tipo, f)))));

        if (quasiTuttoMaiuscolo(testo)) {
            soft.add(TipoViolazione.MAIUSCOLE);
        }
        if (CARATTERE_RIPETUTO.matcher(testo).find() || PAROLA_RIPETUTA.matcher(testo).find()) {
            soft.add(TipoViolazione.RIPETIZIONI);
        }
        return new Esito(List.copyOf(bloccanti), List.copyOf(soft));
    }

    private static List<String> trovaTutti(Pattern modello, String testo) {
        List<String> trovati = new ArrayList<>();
        Matcher m = modello.matcher(testo);
        while (m.find()) {
            String frammento = m.group().strip();
            if (!trovati.contains(frammento)) {
                trovati.add(frammento);
            }
        }
        return trovati;
    }

    private static boolean quasiTuttoMaiuscolo(String testo) {
        long lettere = testo.chars().filter(Character::isLetter).count();
        if (lettere < LETTERE_MINIME_MAIUSCOLE) {
            return false;
        }
        long maiuscole = testo.chars().filter(Character::isUpperCase).count();
        return (double) maiuscole / lettere > QUOTA_MAIUSCOLE;
    }

    /**
     * Varianti normalizzate del testo. Le lettere ripetute si compattano in due modi (a una e a
     * due), così "stronzooo" trova "stronzo" e "cazzzo" trova le parole con la doppia.
     */
    static Set<String> normalizza(String testo) {
        String base = Normalizer.normalize(testo.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        StringBuilder leet = new StringBuilder(base.length());
        for (char c : base.toCharArray()) {
            leet.append(switch (c) {
                case '0' -> 'o';
                case '1' -> 'i';
                case '3' -> 'e';
                case '4', '@' -> 'a';
                case '5', '$' -> 's';
                case '7' -> 't';
                default -> c;
            });
        }
        String tradotto = leet.toString();
        Set<String> varianti = new LinkedHashSet<>();
        varianti.add(tradotto.replaceAll("(\\p{L})\\1{2,}", "$1$1"));
        varianti.add(tradotto.replaceAll("(\\p{L})\\1{2,}", "$1"));
        return varianti;
    }

    /** Un'unica espressione per sezione: voci a parola intera, "*" finale = prefisso, spazi = frase. */
    private static Pattern compila(List<String> voci) {
        String alternative = voci.stream()
                .map(voce -> {
                    boolean prefisso = voce.endsWith("*");
                    String parola = prefisso ? voce.substring(0, voce.length() - 1) : voce;
                    String frase = Pattern.quote(parola).replace(" ", "\\E\\s+\\Q");
                    return frase + (prefisso ? "\\p{L}*" : "");
                })
                .collect(Collectors.joining("|"));
        return Pattern.compile("(?<!\\p{L})(" + alternative + ")(?!\\p{L})");
    }

    private static Map<TipoViolazione, List<String>> caricaListe() {
        Map<TipoViolazione, List<String>> liste = new EnumMap<>(TipoViolazione.class);
        liste.put(TipoViolazione.LINGUAGGIO_OFFENSIVO, new ArrayList<>());
        liste.put(TipoViolazione.DISCRIMINAZIONE, new ArrayList<>());
        try {
            Resource[] file = new PathMatchingResourcePatternResolver()
                    .getResources("classpath:moderazione/*.txt");
            for (Resource risorsa : file) {
                leggi(new String(risorsa.getInputStream().readAllBytes(), StandardCharsets.UTF_8), liste);
            }
            log.info("Liste di moderazione caricate da {} file: {} voci offensive, {} discriminatorie",
                    file.length, liste.get(TipoViolazione.LINGUAGGIO_OFFENSIVO).size(),
                    liste.get(TipoViolazione.DISCRIMINAZIONE).size());
        } catch (IOException e) {
            throw new UncheckedIOException("Impossibile leggere le liste di moderazione", e);
        }
        return liste;
    }

    /** Righe vuote e commenti (#) ignorati; le voci passano dalla stessa normalizzazione del testo. */
    static void leggi(String contenuto, Map<TipoViolazione, List<String>> liste) {
        List<String> sezione = null;
        for (String riga : contenuto.split("\\R")) {
            String voce = riga.strip();
            if (voce.isEmpty() || voce.startsWith("#")) {
                continue;
            }
            if (voce.equals("[offensivo]")) {
                sezione = liste.get(TipoViolazione.LINGUAGGIO_OFFENSIVO);
            } else if (voce.equals("[discriminazione]")) {
                sezione = liste.get(TipoViolazione.DISCRIMINAZIONE);
            } else if (sezione != null) {
                String normalizzata = Normalizer.normalize(voce.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                        .replaceAll("\\p{M}", "");
                if (!sezione.contains(normalizzata)) {
                    sezione.add(normalizzata);
                }
            }
        }
    }
}
