-- Contacts table (leads from DM flows) + CRM tags/notes. Idempotent; safe even if
-- the table never existed in this database.
CREATE TABLE IF NOT EXISTS contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       BIGINT NOT NULL,
  igsid         TEXT NOT NULL,
  name          TEXT,
  email         TEXT,
  phone         TEXT,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags          JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, igsid)
);
-- For databases where contacts already existed without these columns:
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE INDEX IF NOT EXISTS contacts_user_idx ON contacts (user_id, created_at DESC);
