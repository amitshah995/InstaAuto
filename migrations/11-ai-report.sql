-- AI Growth Report (demo mode, no payment yet). Idempotent.
ALTER TABLE audits ADD COLUMN IF NOT EXISTS ai_report JSONB;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS ai_brief JSONB;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS ai_generated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS ai_runs INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_audits_user_ai ON audits (user_id, ai_generated_at DESC);
