-- Contacts CRM: tags + notes. Idempotent.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes TEXT;
