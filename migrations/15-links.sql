-- Tracked short links (affiliate / product links) + click log + abuse reports. Idempotent.
CREATE TABLE IF NOT EXISTS links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     BIGINT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  network     TEXT,
  disclose    BOOLEAN NOT NULL DEFAULT TRUE,   -- add an "(affiliate link)" note where {link:slug} is used
  disabled    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS links_user_idx ON links (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS link_clicks (
  id           BIGSERIAL PRIMARY KEY,
  link_id      UUID NOT NULL,
  clicked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  source       TEXT,
  visitor_hash TEXT,
  is_bot       BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS link_clicks_link_idx ON link_clicks (link_id, clicked_at DESC);

CREATE TABLE IF NOT EXISTS link_reports (
  link_id      UUID NOT NULL,
  visitor_hash TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (link_id, visitor_hash)
);
