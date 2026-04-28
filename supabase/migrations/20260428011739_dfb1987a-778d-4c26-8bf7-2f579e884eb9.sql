
ALTER TABLE public.dd_memos
  ADD COLUMN IF NOT EXISTS analysis_label text DEFAULT 'Initial DD',
  ADD COLUMN IF NOT EXISTS input_type text DEFAULT 'cim',
  ADD COLUMN IF NOT EXISTS input_page_count integer,
  ADD COLUMN IF NOT EXISTS confidence_level text,
  ADD COLUMN IF NOT EXISTS additional_context text;

-- Allow anon read so frontend (no auth yet) can list memos, mirroring other tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='dd_memos' AND policyname='anon_read_dd_memos'
  ) THEN
    CREATE POLICY anon_read_dd_memos ON public.dd_memos
      FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='dd_memos' AND policyname='anon_insert_dd_memos'
  ) THEN
    CREATE POLICY anon_insert_dd_memos ON public.dd_memos
      FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='dd_memos' AND policyname='anon_delete_dd_memos'
  ) THEN
    CREATE POLICY anon_delete_dd_memos ON public.dd_memos
      FOR DELETE TO anon USING (true);
  END IF;
END $$;
