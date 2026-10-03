package com.daniele.crime_app_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
// Avvisi e push (SmistamentoNotifiche) girano su un thread separato, dopo il commit.
@EnableAsync
public class CrimeAppBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(CrimeAppBackendApplication.class, args);
	}

}
