-- Instagram reels/posts shown in the "Videos" section of the shop page. Idempotent.
CREATE TABLE IF NOT EXISTS shop_videos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    BIGINT NOT NULL,
  kind       TEXT NOT NULL,            -- reel | p | tv
  shortcode  TEXT NOT NULL,
  title      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS shop_videos_user_code_idx ON shop_videos (user_id, shortcode);
