-- =========================================================================
-- Statistiche (vedi StatisticheRepository): ogni query filtra per periodo di creazione.
-- =========================================================================
CREATE INDEX idx_segnalazione_data_creazione ON segnalazione (data_creazione);

-- Quando l'admin ha deciso su un abuso: serve al tempo medio di revisione.
ALTER TABLE segnalazione_abuso ADD COLUMN data_esito TIMESTAMP;
