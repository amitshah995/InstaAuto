-- Durable delayed sends. Replaces in-request setTimeout waits for long delays.
-- Idempotent: safe to run more than once.
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'steps',      -- 'steps' | 'flow'
  psid          TEXT NOT NULL,
  payload       JSONB NOT NULL,
  run_at        TIMESTAMPTZ NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,               -- Meta 24h window: never send after this
  status        TEXT NOT NULL DEFAULT 'pending',    -- pending | processing | sent | failed | expired
  attempts      INT NOT NULL DEFAULT 0,
  locked_at     TIMESTAMPTZ,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS scheduled_messages_due_idx ON scheduled_messages (run_at) WHERE status IN ('pending','processing');
CREATE INDEX IF NOT EXISTS scheduled_messages_user_idx ON scheduled_messages (user_id, created_at DESC);
