-- =========================================================================
-- Storico: dopo 12 mesi dalla chiusura una segnalazione viene anonimizzata (autore e
-- descrizione tolti, posizione arrotondata a ~100 m). Restano categoria, gravità, date e zona
-- per le statistiche. Vedi AnonimizzazioneJob.
-- =========================================================================
ALTER TABLE segnalazione ALTER COLUMN autore_id DROP NOT NULL;
ALTER TABLE segnalazione ADD COLUMN data_anonimizzazione TIMESTAMP;

-- Trova in fretta le concluse da anonimizzare, qualunque sia la dimensione dello storico.
CREATE INDEX idx_segnalazione_da_anonimizzare
    ON segnalazione (COALESCE(data_rimozione, data_scadenza))
    WHERE data_anonimizzazione IS NULL AND stato IN ('SCADUTA', 'RIMOSSA');

-- Mappa e lista cercano solo tra le ATTIVA: un indice geografico solo su quelle resta piccolo e
-- veloce anche con milioni di segnalazioni concluse nello storico.
DROP INDEX IF EXISTS idx_segnalazione_posizione;
CREATE INDEX idx_segnalazione_posizione_attive ON segnalazione USING GIST (posizione) WHERE stato = 'ATTIVA';

-- =========================================================================
-- Contatori per utente: statistiche che durano quanto l'account, senza dover tenere
-- l'autore sulle segnalazioni vecchie. Aggiornati a ogni evento (vedi UtenteRepository).
-- =========================================================================
ALTER TABLE utente ADD COLUMN segnalazioni_fatte      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE utente ADD COLUMN segnalazioni_confermate INTEGER NOT NULL DEFAULT 0;
ALTER TABLE utente ADD COLUMN segnalazioni_rimosse    INTEGER NOT NULL DEFAULT 0;

-- Valori iniziali dai dati esistenti.
-- Confermata = ha ricevuto almeno un "sì" da un utente diverso dall'autore.
-- Rimossa = rimossa da un amministratore (non dall'autore stesso).
UPDATE utente u SET
    segnalazioni_fatte = (SELECT count(*) FROM segnalazione s WHERE s.autore_id = u.id),
    segnalazioni_confermate = (
        SELECT count(*) FROM segnalazione s
        WHERE s.autore_id = u.id
          AND EXISTS (SELECT 1 FROM conferma_segnalazione c
                      WHERE c.segnalazione_id = s.id AND c.data_ultimo_si IS NOT NULL AND c.utente_id <> u.id)),
    segnalazioni_rimosse = (
        SELECT count(DISTINCT s.id) FROM segnalazione s
        JOIN evento_moderazione e ON e.segnalazione_id = s.id
        WHERE s.autore_id = u.id AND e.stato_nuovo = 'RIMOSSA' AND e.tipo_attore = 'ADMIN');
