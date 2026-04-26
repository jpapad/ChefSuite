-- Create public storage buckets for recipe images and supplier logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('recipe-images', 'recipe-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('supplier-logos', 'supplier-logos', true, 2097152, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their team folder
CREATE POLICY "auth users can upload recipe images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recipe-images');

CREATE POLICY "recipe images are publicly readable"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'recipe-images');

CREATE POLICY "auth users can delete own recipe images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'recipe-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "auth users can upload supplier logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'supplier-logos');

CREATE POLICY "supplier logos are publicly readable"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'supplier-logos');

CREATE POLICY "auth users can delete own supplier logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'supplier-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
