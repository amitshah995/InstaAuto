-- Follower growth snapshots (one row per account per day) + shareable report links.
CREATE TABLE IF NOT EXISTS follower_snapshots (
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day         date   NOT NULL,
  followers   integer NOT NULL,
  media_count integer,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS report_shares (
  user_id    bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  slug       text NOT NULL UNIQUE,
  enabled    boolean NOT NULL DEFAULT TRUE,
  title      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
