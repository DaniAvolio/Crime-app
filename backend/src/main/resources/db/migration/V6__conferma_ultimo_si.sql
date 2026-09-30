-- =========================================================================
-- Ultimo "sì" di ogni utente su una segnalazione: un utente può prolungare la stessa
-- segnalazione al massimo una volta per durata della categoria (niente No -> Sì a ripetizione).
-- =========================================================================
ALTER TABLE conferma_segnalazione ADD COLUMN data_ultimo_si TIMESTAMP;

-- Voti già esistenti: se l'ultimo voto è un sì, quello è anche l'ultimo sì noto.
UPDATE conferma_segnalazione SET data_ultimo_si = data_voto WHERE ancora_in_atto;
