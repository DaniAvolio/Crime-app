package com.daniele.crime_app_backend.exception;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.stream.Collectors;

/**
 * Gestione centralizzata degli errori per tutti i controller REST, così ogni
 * nuovo controller (Utente, Segnalazione, ...) eredita automaticamente le
 * stesse risposte di errore senza doverle riscrivere.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(RisorsaNonTrovataException.class)
    public ResponseEntity<ErrorResponse> gestisciNonTrovata(RisorsaNonTrovataException ex) {
        log.warn("Risorsa non trovata: {}", ex.getMessage());
        return costruisci(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(ConflittoException.class)
    public ResponseEntity<ErrorResponse> gestisciConflitto(ConflittoException ex) {
        log.warn("Conflitto: {}", ex.getMessage());
        return costruisci(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(CredenzialiNonValideException.class)
    public ResponseEntity<ErrorResponse> gestisciCredenziali(CredenzialiNonValideException ex) {
        log.warn("Login fallito: {}", ex.getMessage());
        return costruisci(HttpStatus.UNAUTHORIZED, ex.getMessage());
    }

    @ExceptionHandler(RichiestaNonValidaException.class)
    public ResponseEntity<ErrorResponse> gestisciRichiestaNonValida(RichiestaNonValidaException ex) {
        return costruisci(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    /** Descrizione bloccata dalla moderazione: 400 con le violazioni, che il client mostra sotto il campo. */
    @ExceptionHandler(DescrizioneNonValidaException.class)
    public ResponseEntity<ErrorResponse> gestisciDescrizioneNonValida(DescrizioneNonValidaException ex) {
        log.warn("{}", ex.getMessage());
        HttpStatus status = HttpStatus.BAD_REQUEST;
        return ResponseEntity.status(status).body(new ErrorResponse(LocalDateTime.now(), status.value(),
                status.getReasonPhrase(), "La descrizione contiene testo non pubblicabile.", ex.getViolazioni()));
    }

    @ExceptionHandler(AccessoNegatoException.class)
    public ResponseEntity<ErrorResponse> gestisciAccessoNegato(AccessoNegatoException ex) {
        log.warn("Accesso negato: {}", ex.getMessage());
        return costruisci(HttpStatus.FORBIDDEN, ex.getMessage());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> gestisciIntegrita(DataIntegrityViolationException ex) {
        log.warn("Violazione di integrità dei dati: {}", ex.getMostSpecificCause().getMessage());
        return costruisci(HttpStatus.CONFLICT,
                "Impossibile completare l'operazione: la risorsa è collegata ad altri dati esistenti.");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> gestisciValidazione(MethodArgumentNotValidException ex) {
        String messaggio = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining("; "));
        log.warn("Validazione fallita: {}", messaggio);
        return costruisci(HttpStatus.BAD_REQUEST, messaggio);
    }

    /** Body JSON malformato o con valori fuori dagli enum (es. un motivo inesistente): errore del client. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> gestisciBodyIlleggibile(HttpMessageNotReadableException ex) {
        log.warn("Body della richiesta non leggibile: {}", ex.getMostSpecificCause().getMessage());
        return costruisci(HttpStatus.BAD_REQUEST, "Richiesta non valida: il contenuto non è leggibile.");
    }

    /**
     * Rete di sicurezza per tutto ciò che non ha un handler dedicato. Le eccezioni
     * MVC di Spring (body illeggibile, metodo non supportato, rotta inesistente, ...)
     * portano già il proprio status e restano errori del client; tutto il resto è
     * un errore imprevisto: viene loggato con stack trace e non espone dettagli.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> gestisciGenerica(Exception ex, HttpServletRequest request) {
        if (ex instanceof org.springframework.web.ErrorResponse erroreSpring) {
            HttpStatusCode status = erroreSpring.getStatusCode();
            log.warn("{} {} -> {}: {}", request.getMethod(), request.getRequestURI(), status.value(), ex.getMessage());
            return costruisci(HttpStatus.valueOf(status.value()), erroreSpring.getBody().getDetail());
        }
        log.error("Errore non gestito su {} {}", request.getMethod(), request.getRequestURI(), ex);
        return costruisci(HttpStatus.INTERNAL_SERVER_ERROR, "Errore interno del server.");
    }

    private ResponseEntity<ErrorResponse> costruisci(HttpStatus status, String messaggio) {
        ErrorResponse body = new ErrorResponse(LocalDateTime.now(), status.value(), status.getReasonPhrase(), messaggio);
        return ResponseEntity.status(status).body(body);
    }
}
