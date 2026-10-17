-- Banner image shown across the top of the public shop page. Idempotent.
ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
