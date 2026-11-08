-- Studio posts shown on the creator shop page (/@handle) and on their own page (/@handle/p/:id). Idempotent.
CREATE TABLE IF NOT EXISTS shop_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     BIGINT NOT NULL,
  kind        TEXT NOT NULL,                       -- images | reel
  caption     TEXT,
  images      TEXT[] NOT NULL DEFAULT '{}',        -- our storage URLs, in carousel order
  reel_kind   TEXT,                                -- reel | p | tv (only for kind = reel)
  reel_code   TEXT,
  link_ids    UUID[] NOT NULL DEFAULT '{}',        -- tagged products (rows of links), in order
  published   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_posts_user_idx ON shop_posts (user_id, created_at DESC);
