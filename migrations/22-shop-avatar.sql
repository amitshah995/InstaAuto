-- Profile picture / brand logo for the public shop page. Idempotent.
ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
