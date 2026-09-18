package com.daniele.crime_app_backend.exception;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(RisorsaNonTrovataException.class)
    public ResponseEntity<ErrorResponse> gestisciNonTrovata(RisorsaNonTrovataException ex) {
        return costruisci(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(ConflittoException.class)
    public ResponseEntity<ErrorResponse> gestisciConflitto(ConflittoException ex) {
        return costruisci(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> gestisciIntegrita(DataIntegrityViolationException ex) {
        return costruisci(HttpStatus.CONFLICT,
                "Impossibile completare l'operazione: la risorsa è collegata ad altri dati esistenti.");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> gestisciValidazione(MethodArgumentNotValidException ex) {
        String messaggio = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining("; "));
        return costruisci(HttpStatus.BAD_REQUEST, messaggio);
    }

    private ResponseEntity<ErrorResponse> costruisci(HttpStatus status, String messaggio) {
        ErrorResponse body = new ErrorResponse(LocalDateTime.now(), status.value(), status.getReasonPhrase(), messaggio);
        return ResponseEntity.status(status).body(body);
    }
}
