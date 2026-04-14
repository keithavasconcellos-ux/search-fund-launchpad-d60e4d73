
-- 1. Add sending_provider and scheduled_at to email_threads
ALTER TABLE public.email_threads
  ADD COLUMN IF NOT EXISTS sending_provider text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- 2. Create email_sequences table
CREATE TABLE IF NOT EXISTS public.email_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_vertical text,
  is_active boolean NOT NULL DEFAULT true,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_sequences" ON public.email_sequences
  FOR SELECT TO anon USING (true);

CREATE POLICY "auth_all_sequences" ON public.email_sequences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER set_email_sequences_updated_at
  BEFORE UPDATE ON public.email_sequences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Create scheduled_calls table
CREATE TABLE IF NOT EXISTS public.scheduled_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  duration_mins smallint NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes text,
  provider text NOT NULL DEFAULT 'manual',
  external_event_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_scheduled_calls" ON public.scheduled_calls
  FOR SELECT TO anon USING (true);

CREATE POLICY "auth_all_scheduled_calls" ON public.scheduled_calls
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
