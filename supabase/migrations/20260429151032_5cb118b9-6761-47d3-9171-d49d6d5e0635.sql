CREATE POLICY "anon_delete_businesses" ON public.businesses FOR DELETE TO anon USING (true);
CREATE POLICY "anon_delete_activities" ON public.activities FOR DELETE TO anon USING (true);
CREATE POLICY "anon_delete_contacts" ON public.contacts FOR DELETE TO anon USING (true);
CREATE POLICY "anon_delete_email_threads" ON public.email_threads FOR DELETE TO anon USING (true);
CREATE POLICY "anon_delete_dd_documents" ON public.dd_documents FOR DELETE TO anon USING (true);
CREATE POLICY "anon_delete_business_classifications" ON public.business_classifications FOR DELETE TO anon USING (true);
CREATE POLICY "anon_delete_scheduled_calls" ON public.scheduled_calls FOR DELETE TO anon USING (true);