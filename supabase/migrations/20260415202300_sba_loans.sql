-- Migration to add SBA loans and modify businesses table

CREATE TABLE IF NOT EXISTS public.sba_loans (
    id uuid PRIMARY KEY,
    program text,
    borr_name text,
    borr_city text,
    borr_state text,
    borr_zip text,
    naics_code text,
    approval_date date,
    gross_approval numeric,
    loan_status text,
    matched_business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
    match_confidence numeric,
    match_method text
);

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS sba_loan_approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sba_loan_year integer,
ADD COLUMN IF NOT EXISTS sba_loan_amount_bucket text;
