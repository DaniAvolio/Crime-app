package com.daniele.crime_app_backend.config;

import com.daniele.crime_app_backend.exception.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.time.LocalDateTime;

/**
 * I 401/403 generati dalla filter chain di Spring Security non passano dal
 * GlobalExceptionHandler (avvengono prima dei controller): questo handler li
 * serializza nello stesso formato ErrorResponse usato dal resto dell'API.
 */
@Slf4j
@Component
public class ErroriSicurezzaHandler implements AuthenticationEntryPoint, AccessDeniedHandler {

    private final JsonMapper jsonMapper;

    public ErroriSicurezzaHandler(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException ex) throws IOException {
        log.warn("{} {} -> 401: {}", request.getMethod(), request.getRequestURI(), ex.getMessage());
        scrivi(response, HttpStatus.UNAUTHORIZED, "Autenticazione richiesta o sessione scaduta.");
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException ex) throws IOException {
        log.warn("{} {} -> 403: {}", request.getMethod(), request.getRequestURI(), ex.getMessage());
        scrivi(response, HttpStatus.FORBIDDEN, "Non hai i permessi per eseguire questa operazione.");
    }

    private void scrivi(HttpServletResponse response, HttpStatus status, String messaggio) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        jsonMapper.writeValue(response.getWriter(),
                new ErrorResponse(LocalDateTime.now(), status.value(), status.getReasonPhrase(), messaggio));
    }
}
