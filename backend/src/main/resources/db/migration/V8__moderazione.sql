-- =========================================================================
-- Moderazione: abusi con motivo codificato, peso (fiducia del segnalante) ed esito della
-- revisione admin; coda "da rivedere" sulle segnalazioni. Vedi SegnalazioneAbusoService.
-- =========================================================================

-- Motivo: da testo libero a codice. I motivi liberi esistenti diventano ALTRO con nota.
ALTER TABLE segnalazione_abuso ADD COLUMN nota VARCHAR(300);
UPDATE segnalazione_abuso SET nota = LEFT(motivo, 300), motivo = 'ALTRO';
ALTER TABLE segnalazione_abuso ALTER COLUMN motivo TYPE VARCHAR(30);
ALTER TABLE segnalazione_abuso ADD CONSTRAINT ck_segnalazione_abuso_motivo
    CHECK (motivo IN ('FALSA', 'OFFENSIVA', 'DATI_PERSONALI', 'SPAM', 'CATEGORIA_ERRATA', 'ALTRO'));

-- Peso al momento dell'invio (fiducia del segnalante / 100, minimo 0.25): i dati esistenti valgono 1.
ALTER TABLE segnalazione_abuso ADD COLUMN peso NUMERIC(4, 2) NOT NULL DEFAULT 1;

-- Esito della revisione admin: NULL = in attesa.
ALTER TABLE segnalazione_abuso ADD COLUMN esito VARCHAR(12);
ALTER TABLE segnalazione_abuso ADD CONSTRAINT ck_segnalazione_abuso_esito
    CHECK (esito IS NULL OR esito IN ('FONDATO', 'INFONDATO'));

-- Abusi in attesa denormalizzati sulla segnalazione: la tabella di gestione li ordina e filtra
-- nel database senza subquery. Aggiornati solo con update atomici (SegnalazioneRepository).
ALTER TABLE segnalazione ADD COLUMN numero_abusi INTEGER NOT NULL DEFAULT 0;
ALTER TABLE segnalazione ADD COLUMN peso_abusi NUMERIC(6, 2) NOT NULL DEFAULT 0;
-- Coda dell'admin: abusi in attesa o controlli automatici sulla descrizione scattati.
ALTER TABLE segnalazione ADD COLUMN da_rivedere BOOLEAN NOT NULL DEFAULT FALSE;
-- Codici dei controlli "soft" scattati alla creazione (es. "MAIUSCOLE,RIPETIZIONI").
ALTER TABLE segnalazione ADD COLUMN revisione_automatica VARCHAR(100);

UPDATE segnalazione s SET
    numero_abusi = a.numero,
    peso_abusi = a.peso,
    da_rivedere = TRUE
FROM (SELECT segnalazione_id, count(*) AS numero, sum(peso) AS peso
      FROM segnalazione_abuso WHERE esito IS NULL GROUP BY segnalazione_id) a
WHERE a.segnalazione_id = s.id;

CREATE INDEX idx_segnalazione_da_rivedere ON segnalazione (data_creazione) WHERE da_rivedere;
