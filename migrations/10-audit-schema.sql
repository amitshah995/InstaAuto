-- Phase 0: schema for the Instagram Audit funnel.
-- Idempotent: safe to run more than once.

-- 1. Contact capture. Instagram Login does not return an email, and the services /
--    DM-automation upsell needs a way to reach the user (with consent).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_captured_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_source TEXT; -- e.g. 'audit', 'direct'

-- 2. Audits. `teaser` is the ONLY column the public (logged-out) page may read.
--    `report` holds the full gated payload and must never be sent to anonymous callers.
CREATE TABLE IF NOT EXISTS audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_username TEXT NOT NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  tier TEXT NOT NULL DEFAULT 'public' CHECK (tier IN ('public', 'connected')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  score INTEGER CHECK (score BETWEEN 0 AND 100),
  teaser JSONB NOT NULL DEFAULT '{}'::jsonb,
  report JSONB,
  requester_ip_hash TEXT, -- hashed, for throttling only
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audits_username_created ON audits (lower(ig_username), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audits_user_id ON audits (user_id);
CREATE INDEX IF NOT EXISTS idx_audits_ip_created ON audits (requester_ip_hash, created_at DESC);

-- 3. Cache for public (Tier 0) lookups so one lookup account is not hammered.
CREATE TABLE IF NOT EXISTS ig_lookup_cache (
  ig_username TEXT PRIMARY KEY, -- stored lowercase
  payload JSONB NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Daily snapshots of a connected account. The Graph API only exposes limited history,
--    so growth charts exist only from the day we start recording.
CREATE TABLE IF NOT EXISTS audit_snapshots (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  followers_count INTEGER,
  media_count INTEGER,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb, -- reach, profile_views, interactions, ...
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_audit_snapshots_user_date ON audit_snapshots (user_id, snapshot_date DESC);

-- 5. Competitor tracking (public Business/Creator accounts only).
--    Keep competitor data minimal and aggregated: followers, counts, averages.
CREATE TABLE IF NOT EXISTS competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ig_username TEXT NOT NULL, -- stored lowercase
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, ig_username)
);

CREATE TABLE IF NOT EXISTS competitor_snapshots (
  id BIGSERIAL PRIMARY KEY,
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  followers_count INTEGER,
  media_count INTEGER,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb, -- avg likes/comments, posts in last 30d, ...
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (competitor_id, snapshot_date)
);

-- 6. Leads for services / DM-automation upsell.
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  interest TEXT NOT NULL DEFAULT 'other' CHECK (interest IN ('dm_automation', 'smm_services', 'tools', 'other')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'won', 'lost')),
  notes TEXT,
  consent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_leads_status_created ON leads (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads (user_id);
