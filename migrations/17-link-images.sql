-- Product image for the shop page (fetched from the product page's preview image, or pasted by the owner). Idempotent.
ALTER TABLE links ADD COLUMN IF NOT EXISTS image_url TEXT;
