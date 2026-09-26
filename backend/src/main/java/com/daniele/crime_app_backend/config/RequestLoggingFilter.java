package com.daniele.crime_app_backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/** Logga una riga per ogni chiamata alle API: metodo, percorso, status e durata. */
@Slf4j
@Component
public class RequestLoggingFilter extends OncePerRequestFilter {

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        long inizio = System.currentTimeMillis();
        try {
            filterChain.doFilter(request, response);
        } finally {
            long durataMs = System.currentTimeMillis() - inizio;
            String query = request.getQueryString() != null ? "?" + request.getQueryString() : "";
            log.info("{} {}{} -> {} ({} ms)", request.getMethod(), request.getRequestURI(), query,
                    response.getStatus(), durataMs);
        }
    }
}
