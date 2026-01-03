-- Migrazione: Aggiunta colonna email_pec alla tabella clienti
-- Data: 2025-01-XX
-- Descrizione: Aggiunge il campo email_pec per separare PEC da email_amministrazione

-- Aggiungi la colonna email_pec
ALTER TABLE clienti ADD COLUMN IF NOT EXISTS email_pec VARCHAR;

-- Per retrocompatibilità: se un cliente è PA e ha email_amministrazione ma non email_pec,
-- copia email_amministrazione in email_pec (opzionale, commentato)
-- UPDATE clienti SET email_pec = email_amministrazione WHERE is_pa = true AND email_pec IS NULL AND email_amministrazione IS NOT NULL;

-- Commento sulla colonna
COMMENT ON COLUMN clienti.email_pec IS 'PEC (Posta Elettronica Certificata) per fatturazione elettronica PA';

