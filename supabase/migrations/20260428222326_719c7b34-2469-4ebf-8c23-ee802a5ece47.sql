-- Allow anon role to insert new businesses (matches existing anon SELECT/UPDATE policies).
CREATE POLICY "anon_insert_businesses"
ON public.businesses
FOR INSERT
TO anon
WITH CHECK (true);