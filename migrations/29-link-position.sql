-- Manual order of links on the Links page and the public shop page. NULL = not ordered yet (newest first). Idempotent.
ALTER TABLE links ADD COLUMN IF NOT EXISTS position INTEGER;
