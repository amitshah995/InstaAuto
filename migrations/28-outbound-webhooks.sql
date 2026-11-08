-- Phase 4: outbound webhooks (per-user endpoints + delivery log). Idempotent: safe to run more than once.
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id                   BIGSERIAL PRIMARY KEY,
  user_id              BIGINT NOT NULL,
  label                TEXT,
  url                  TEXT NOT NULL,
  secret               TEXT NOT NULL,                      -- HMAC signing secret (encrypted with TOKEN_ENCRYPTION_KEY when set)
  events               TEXT[] NOT NULL,                    -- lead_captured | dm_sent | dm_failed | comment_matched
  preset               TEXT NOT NULL DEFAULT 'generic',    -- generic | sheets
  enabled              BOOLEAN NOT NULL DEFAULT TRUE,
  consecutive_failures INT NOT NULL DEFAULT 0,             -- auto-disables after too many dead deliveries in a row
  disabled_reason      TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_endpoints_user_idx ON webhook_endpoints (user_id);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id               BIGSERIAL PRIMARY KEY,
  endpoint_id      BIGINT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  user_id          BIGINT NOT NULL,
  event            TEXT NOT NULL,
  event_id         TEXT NOT NULL,                          -- stable id sent to the receiver so it can de-duplicate retries
  payload          JSONB NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',        -- pending | delivered | dead
  attempts         INT NOT NULL DEFAULT 0,
  next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until     TIMESTAMPTZ,
  last_status_code INT,
  last_error       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_due_idx ON webhook_deliveries (next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS webhook_deliveries_endpoint_idx ON webhook_deliveries (endpoint_id, created_at DESC);
