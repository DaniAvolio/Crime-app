package com.daniele.crime_app_backend.service.notifiche;

import com.daniele.crime_app_backend.entity.enums.TipoNotifica;

/**
 * Eventi applicativi che generano avvisi. Si pubblicano con ApplicationEventPublisher dentro la
 * transazione che li causa; NotificheService li gestisce solo dopo il commit e in un altro thread,
 * così chi pubblica non aspetta l'invio delle push e un rollback non manda avvisi falsi.
 */
public final class EventiNotifica {

    private EventiNotifica() {
    }

    /** Una nuova segnalazione è stata pubblicata: avvisa chi ha una zona che la contiene. */
    public record SegnalazionePubblicata(Long segnalazioneId) {}

    /** Novità su una segnalazione per il suo autore (confermata, chiusa, rimossa, sospesa). */
    public record SegnalazioneAggiornata(Long segnalazioneId, TipoNotifica tipo) {}
}
