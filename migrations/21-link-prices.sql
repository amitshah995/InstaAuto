-- Optional price and MRP (whole rupees) the seller types in, so the shop can show "₹1,765  ₹4,999  65% off". Idempotent.
ALTER TABLE links ADD COLUMN IF NOT EXISTS price_inr INTEGER CHECK (price_inr IS NULL OR (price_inr > 0 AND price_inr <= 10000000));
ALTER TABLE links ADD COLUMN IF NOT EXISTS mrp_inr INTEGER CHECK (mrp_inr IS NULL OR (mrp_inr > 0 AND mrp_inr <= 10000000));
