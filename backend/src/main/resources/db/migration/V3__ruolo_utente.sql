-- =========================================================================
-- Ruolo applicativo dell'utente (autorizzazione: UTENTE standard o ADMIN).
-- Tutti gli utenti esistenti diventano UTENTE; il primo admin va promosso a mano:
--   UPDATE utente SET ruolo = 'ADMIN' WHERE email = '...';
-- =========================================================================
ALTER TABLE utente ADD COLUMN ruolo VARCHAR(20) NOT NULL DEFAULT 'UTENTE';
ALTER TABLE utente ADD CONSTRAINT ck_utente_ruolo CHECK (ruolo IN ('UTENTE', 'ADMIN'));
