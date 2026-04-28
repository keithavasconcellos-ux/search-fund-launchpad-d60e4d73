CREATE POLICY "anon_upload_dd_documents" ON storage.objects
FOR INSERT TO anon
WITH CHECK (bucket_id = 'dd-documents');

CREATE POLICY "anon_read_dd_documents" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'dd-documents');

CREATE POLICY "anon_delete_dd_documents" ON storage.objects
FOR DELETE TO anon
USING (bucket_id = 'dd-documents');