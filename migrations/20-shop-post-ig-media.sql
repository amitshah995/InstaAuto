-- Reel posts picked from the owner's own Instagram account (played inline, not via the embed). Idempotent.
ALTER TABLE shop_posts ADD COLUMN IF NOT EXISTS ig_media_id TEXT;
