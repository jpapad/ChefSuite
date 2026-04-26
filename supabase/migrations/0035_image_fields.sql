-- Add image_url to recipes and logo_url to suppliers
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS image_url text DEFAULT NULL;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS logo_url text DEFAULT NULL;

-- Storage buckets are created via Supabase dashboard or CLI:
-- supabase storage create recipe-images --public
-- supabase storage create supplier-logos --public
