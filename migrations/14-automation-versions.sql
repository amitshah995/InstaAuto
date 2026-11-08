-- Flow version history: a snapshot is saved each time an automation is edited. Idempotent.
CREATE TABLE IF NOT EXISTS automation_versions (
  id               BIGSERIAL PRIMARY KEY,
  automation_id    UUID NOT NULL,
  user_id          BIGINT,
  name             TEXT,
  trigger_value    TEXT,
  response_content JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_versions_idx ON automation_versions (automation_id, created_at DESC);
