-- Add SOS registry lookup storage to businesses table
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS sos_data jsonb,
  ADD COLUMN IF NOT EXISTS sos_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS sos_state text;
