
CREATE POLICY "org members read training docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'training-documents'
         AND public.is_org_member((split_part(name, '/', 1))::uuid, auth.uid()));
CREATE POLICY "org admins insert training docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'training-documents'
              AND public.is_org_admin((split_part(name, '/', 1))::uuid, auth.uid()));
CREATE POLICY "org admins update training docs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'training-documents'
         AND public.is_org_admin((split_part(name, '/', 1))::uuid, auth.uid()));
CREATE POLICY "org admins delete training docs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'training-documents'
         AND public.is_org_admin((split_part(name, '/', 1))::uuid, auth.uid()));
