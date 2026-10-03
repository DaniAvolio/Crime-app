package com.daniele.crime_app_backend.entity.enums;

/** Perché un utente riceve un avviso (vedi Notifica e NotificheService). */
public enum TipoNotifica {
    /** Nuova segnalazione in una delle sue zone. */
    VICINA,
    /** Una sua segnalazione ha ricevuto il primo "è ancora in atto" da un altro utente. */
    CONFERMATA,
    /** Una sua segnalazione è stata chiusa dai voti "non più in atto". */
    CHIUSA,
    /** Una sua segnalazione è stata rimossa da un amministratore. */
    RIMOSSA,
    /** Una sua segnalazione è stata sospesa dopo le segnalazioni di abuso. */
    SOSPESA
}
