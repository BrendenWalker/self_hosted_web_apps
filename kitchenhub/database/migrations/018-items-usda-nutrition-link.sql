-- Add USDA FoodData Central linkage/provenance fields to items.
-- Run once: psql -U <user> -d <db> -f kitchenhub/database/migrations/018-items-usda-nutrition-link.sql

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS usda_fdc_id INTEGER;

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS usda_data_type TEXT;

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS usda_description TEXT;

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS nutrition_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_items_usda_fdc_id ON items(usda_fdc_id);

INSERT INTO common.measurements (name, to_grams)
VALUES ('g', 1.00)
ON CONFLICT (name) DO UPDATE SET to_grams = EXCLUDED.to_grams;
