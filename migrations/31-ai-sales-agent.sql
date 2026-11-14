-- AI Sales Agent (phase 1). Idempotent: safe to run more than once. Run in the Supabase SQL editor.
-- Every table is scoped by user_id and every query in lib/agent/store.ts filters on it.

-- What the business knows about ONE Reel. The agent answers only from this (plus users.ai_context).
CREATE TABLE IF NOT EXISTS media_knowledge (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  media_id   TEXT NOT NULL,                        -- Instagram Media_ID of the Reel
  title      TEXT NOT NULL DEFAULT '',
  caption    TEXT NOT NULL DEFAULT '',
  offer      TEXT NOT NULL DEFAULT '',
  faqs       JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{ "q": "...", "a": "..." }]
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, media_id)
);

-- Conversation memory for the agent loop. One live conversation per person per account.
CREATE TABLE IF NOT EXISTS agent_conversations (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  igsid      TEXT NOT NULL,
  media_id   TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'active',       -- active | ended | handoff
  state      JSONB NOT NULL DEFAULT '{}'::jsonb,   -- consent, pending phone, token use, flags (see lib/agent/types.ts)
  turn_count INT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0,               -- compare-and-set guard against two DMs racing
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, igsid)
);
CREATE INDEX IF NOT EXISTS agent_conversations_user_idx ON agent_conversations (user_id, updated_at DESC);

-- Per-account agent settings (tone, language, handoff rules, lead score numbers, on/off).
CREATE TABLE IF NOT EXISTS agent_settings (
  user_id           BIGINT PRIMARY KEY,
  enabled           BOOLEAN NOT NULL DEFAULT FALSE,
  tone              TEXT NOT NULL DEFAULT 'friendly',    -- friendly | professional | casual
  language          TEXT NOT NULL DEFAULT 'auto',        -- auto | english | hindi | hinglish
  handoff_rules     TEXT NOT NULL DEFAULT '',
  scores            JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { wa_lead, email_lead, engaged }
  connector_skipped BOOLEAN NOT NULL DEFAULT FALSE,
  settings_saved    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lead fields live on contacts (existing table). Phones from the agent are E.164.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_status        TEXT;          -- new | engaged | email_lead | wa_lead | handoff
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score         INT NOT NULL DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_media_id      TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone_consent_at   TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS consent_text       TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS unverified_phone   TEXT;          -- number given WITHOUT consent: never forwarded
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_consent_at   TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_updated_at    TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS contacts_lead_idx ON contacts (user_id, lead_status, lead_updated_at DESC) WHERE lead_status IS NOT NULL;

-- Dispatch idempotency + audit: one row per (account, person, reel, kind). The unique key is what makes
-- "one dispatch per contact per media" true even when two requests race.
CREATE TABLE IF NOT EXISTS lead_events (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  igsid      TEXT NOT NULL,
  media_id   TEXT NOT NULL DEFAULT '',
  kind       TEXT NOT NULL,                        -- whatsapp | email
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, igsid, media_id, kind)
);
