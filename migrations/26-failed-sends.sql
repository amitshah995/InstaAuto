-- Phase 1: persistent record of DMs that could not be delivered, plus webhook payload retention index.
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.
-- Never stores access tokens. api_body is the outgoing Graph API payload only.
CREATE TABLE IF NOT EXISTS failed_sends (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL,
  source         TEXT NOT NULL DEFAULT 'dm',          -- dm | scheduled | retry
  recipient      JSONB NOT NULL,                       -- {"comment_id": ".."} private reply, or {"id": "psid"}
  psid           TEXT,
  api_body       JSONB NOT NULL,                       -- exact body that failed (no token)
  rest_steps     JSONB,                                -- later steps of the sequence, resumed if the retry succeeds
  preview        TEXT,                                 -- short human-readable text for the dashboard
  failure_kind   TEXT NOT NULL,                        -- transient | permanent
  reason         TEXT,                                 -- rate_limit | server | network | token | window | permission | invalid | spam | unavailable | unknown
  error_code     INT,
  error_subcode  INT,
  error_message  TEXT,
  status         TEXT NOT NULL DEFAULT 'open',         -- open (will retry) | dead (permanent or gave up) | recovered | expired | dismissed
  attempts       INT NOT NULL DEFAULT 1,
  next_retry_at  TIMESTAMPTZ,
  window_until   TIMESTAMPTZ NOT NULL,                 -- 24h DM window, or 7 days for a comment private reply
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS failed_sends_user_idx ON failed_sends (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS failed_sends_due_idx ON failed_sends (next_retry_at) WHERE status = 'open';

-- Retention cleanup of raw webhook payloads filters on processed_at.
CREATE INDEX IF NOT EXISTS webhook_events_processed_at_idx ON webhook_events (processed_at);
