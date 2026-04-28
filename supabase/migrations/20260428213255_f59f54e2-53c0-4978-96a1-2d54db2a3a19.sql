CREATE POLICY anon_read_email_templates ON public.email_templates FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_email_templates ON public.email_templates FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_email_templates ON public.email_templates FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_email_templates ON public.email_templates FOR DELETE TO anon USING (true);