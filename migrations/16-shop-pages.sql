-- Creator shop page (/@handle). Opt-in: nothing is public until the owner publishes and ticks links. Idempotent.
CREATE TABLE IF NOT EXISTS shop_profiles (
  user_id      BIGINT PRIMARY KEY,
  handle       TEXT NOT NULL,                 -- stored lowercase; defaults to the owner's Instagram username
  display_name TEXT,
  bio          TEXT,
  published    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS shop_profiles_handle_idx ON shop_profiles (lower(handle));

-- Which links appear on the shop page. Off by default: the owner picks each one.
ALTER TABLE links ADD COLUMN IF NOT EXISTS shop_visible BOOLEAN NOT NULL DEFAULT FALSE;
