GRANT SELECT, INSERT, DELETE ON public.activities TO anon;
CREATE POLICY anon_insert_activities ON public.activities FOR INSERT TO anon WITH CHECK (true);