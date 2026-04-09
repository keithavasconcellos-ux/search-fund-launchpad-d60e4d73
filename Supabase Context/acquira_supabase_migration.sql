-- ============================================================
-- ACQUIRA — Supabase Schema Migration
-- Run this in full in the Supabase SQL Editor
-- Project: Search Fund Workflow Tool
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";


-- ============================================================
-- 1. HIERARCHY TAXONOMY
-- Reference table — load your hierarchy file into this.
-- Drives Map View filters, Library filters, and auto-classification.
-- ============================================================
create table if not exists hierarchy_taxonomy (
  id              uuid primary key default uuid_generate_v4(),
  vertical        text not null,
  category        text not null,
  business_type   text not null,
  sf_score        smallint not null check (sf_score between 1 and 5),
  created_at      timestamptz not null default now()
);

comment on table hierarchy_taxonomy is 'SF hierarchy: Vertical → Category → Business Type with SF score. Loaded from the classification Excel file.';


-- ============================================================
-- 2. NAICS BENCHMARKS
-- Revenue-per-employee ranges by business type.
-- Powers Signal 1 revenue estimation.
-- ============================================================
create table if not exists naics_benchmarks (
  business_type         text primary key,
  revenue_per_emp_low   int not null,
  revenue_per_emp_high  int not null,
  updated_at            timestamptz not null default now()
);

comment on table naics_benchmarks is 'Revenue per employee benchmarks by business type. Used for Signal 1 revenue estimation.';


-- ============================================================
-- 3. USER SETTINGS
-- Single-user app — one row per user.
-- search_start_date powers the "Day 142" counter on the dashboard.
-- ============================================================
create table if not exists user_settings (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  display_name        text,
  search_start_date   date,
  default_zip         text,
  gmail_connected     boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table user_settings is 'Per-user settings. One row per user. search_start_date drives the day counter on the dashboard.';


-- ============================================================
-- 4. BUSINESSES
-- Core entity. Every business in the system lives here.
-- Sourced from: Excel import, Map View discovery, or manual entry.
-- ============================================================
create table if not exists businesses (
  id                      uuid primary key default uuid_generate_v4(),
  place_id                text unique,                        -- Google Places ID — join key from the Excel
  name                    text not null,
  address                 text,
  lat                     double precision,
  lng                     double precision,
  website                 text,
  phone                   text,
  google_types            text[],                             -- raw Places API type tags array

  -- Google signals
  rating                  numeric(3,1),
  review_count            int,
  employee_count          int,
  employee_count_source   text,                               -- google / manual / estimated

  -- Business details
  founded_year            smallint,

  -- CRM pipeline
  crm_stage               text not null default 'identified'
                            check (crm_stage in (
                              'identified','contacted','engaged',
                              'nda_signed','cim_received','active_loi','passed'
                            )),

  -- Review / targeting status
  review_status           text not null default 'unreviewed'
                            check (review_status in ('unreviewed','target','watch','pass')),
  review_status_set_at    timestamptz,

  -- Revenue estimation (computed at import, stored here)
  revenue_est_low         bigint,
  revenue_est_high        bigint,
  revenue_confidence      text check (revenue_confidence in ('low','medium','high')),
  revenue_est_sources     text[],

  -- Verified financials (entered after NDA/CIM)
  revenue_verified        boolean default false,
  revenue_verified_value  bigint,
  revenue_verified_source text,
  revenue_verified_at     timestamptz,
  ebitda_verified         boolean default false,
  ebitda_margin_verified  numeric(5,2),

  -- Website scoring (Signal 3 — set by AI scrape at import)
  website_score           smallint check (website_score between 0 and 10),
  website_score_at        timestamptz,

  -- Deal tracking
  deal_confidence_score   smallint check (deal_confidence_score between 0 and 100),
  cim_url                 text,
  cim_uploaded_at         timestamptz,

  -- Provenance
  added_via               text default 'import'
                            check (added_via in ('import','map','manual')),
  last_activity_at        timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table businesses is 'Core business entity. Every tracked company. Sources: Excel import, Map View, manual entry.';
comment on column businesses.place_id is 'Google Places ID. Natural join key with the classification Excel. Unique — one row per physical business location.';
comment on column businesses.crm_stage is 'Pipeline stage. One of: identified, contacted, engaged, nda_signed, cim_received, active_loi, passed.';
comment on column businesses.website_score is '0–10 score from the Signal 3 website rubric. Set by Claude Haiku at import time.';


-- ============================================================
-- 5. BUSINESS CLASSIFICATIONS
-- Separate from businesses so classifications can be versioned,
-- overridden, and re-run without touching the core record.
-- ============================================================
create table if not exists business_classifications (
  id                uuid primary key default uuid_generate_v4(),
  business_id       uuid not null references businesses(id) on delete cascade,
  vertical          text,                                     -- Business Services / Healthcare / Technology-Enabled Services
  category          text,                                     -- Consumer Services / Physician & Clinical / etc.
  business_type     text,                                     -- HVAC / Dental / Veterinary / etc.
  gbp_confidence    text check (gbp_confidence in ('High','Medium','Low')),
  match_status      text,                                     -- Classified / Classified — Low Confidence / Unclassified — Non-Target
  sf_score          smallint check (sf_score between 1 and 5),
  classified_at     timestamptz not null default now(),
  classified_by     text default 'import'
                      check (classified_by in ('import','model','manual'))
);

comment on table business_classifications is 'Classification of each business in the SF hierarchy. Separate from businesses for versioning. classified_by tracks whether it was set at import, by an AI model, or manually overridden.';

-- Index for fast filtering in Library and Map View
create index if not exists idx_biz_class_business_id on business_classifications(business_id);
create index if not exists idx_biz_class_vertical on business_classifications(vertical);
create index if not exists idx_biz_class_sf_score on business_classifications(sf_score);


-- ============================================================
-- 6. CONTACTS
-- People associated with a business.
-- Multiple contacts per business supported.
-- ============================================================
create table if not exists contacts (
  id                    uuid primary key default uuid_generate_v4(),
  business_id           uuid not null references businesses(id) on delete cascade,
  name                  text not null,
  role                  text,
  email                 text,
  phone                 text,
  linkedin_url          text,
  is_owner              boolean default false,
  estimated_age         smallint,
  preferred_contact     text check (preferred_contact in ('email','phone','linkedin')),
  notes                 text,
  last_contacted_at     timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table contacts is 'People associated with a business. One business can have multiple contacts.';

create index if not exists idx_contacts_business_id on contacts(business_id);


-- ============================================================
-- 7. ACTIVITIES
-- Append-only event log. Never deleted.
-- Powers: Recent Activity feed, last_activity_at, full audit trail.
-- One table for all event types — stage changes, notes, emails, DD events.
-- ============================================================
create table if not exists activities (
  id            uuid primary key default uuid_generate_v4(),
  business_id   uuid not null references businesses(id) on delete cascade,
  contact_id    uuid references contacts(id) on delete set null,
  type          text not null
                  check (type in (
                    'stage_change','note','email_sent','email_opened',
                    'email_replied','cim_uploaded','memo_generated',
                    'contact_added','status_change','manual'
                  )),
  body          text,                                         -- free text for notes; summary for other types
  from_stage    text,                                         -- for stage_change events
  to_stage      text,                                         -- for stage_change events
  metadata      jsonb,                                        -- flexible structured data per event type
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

comment on table activities is 'Append-only event log for all business activity. Never deleted. Powers the Recent Activity feed and last_activity_at on businesses.';
comment on column activities.metadata is 'Flexible JSON for event-specific data. E.g. for email_sent: {template_id, letter_number, subject}. For memo_generated: {memo_id, sections_completed}.';

create index if not exists idx_activities_business_id on activities(business_id);
create index if not exists idx_activities_created_at on activities(created_at desc);
create index if not exists idx_activities_type on activities(type);


-- ============================================================
-- 8. EMAIL TEMPLATES
-- Reusable letter templates with variable placeholders.
-- letter_number enables sequencing (Letter 1, 2, 3).
-- ============================================================
create table if not exists email_templates (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  letter_number     smallint not null default 1,
  subject_template  text not null,
  body_template     text not null,                            -- supports {{business_name}}, {{owner_name}}, {{city}} etc.
  target_vertical   text,                                     -- optional — filter to a specific vertical
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table email_templates is 'Reusable outreach letter templates. body_template supports {{variable}} placeholders for AI personalization.';


-- ============================================================
-- 9. EMAIL THREADS
-- One row per email sent (or drafted).
-- Tracks full lifecycle: draft → sent → opened → replied.
-- ============================================================
create table if not exists email_threads (
  id                    uuid primary key default uuid_generate_v4(),
  business_id           uuid not null references businesses(id) on delete cascade,
  contact_id            uuid references contacts(id) on delete set null,
  template_id           uuid references email_templates(id) on delete set null,
  letter_number         smallint,
  subject               text not null,
  body_html             text,
  body_text             text,
  status                text not null default 'draft'
                          check (status in ('draft','sent','opened','replied','bounced','unsubscribed')),
  response_classification text
                          check (response_classification in (
                            'positive','negative','neutral','out_of_office','not_classified'
                          )),
  sent_at               timestamptz,
  opened_at             timestamptz,
  replied_at            timestamptz,
  reply_body            text,                                 -- inbound reply text stored here
  gmail_message_id      text,
  gmail_thread_id       text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table email_threads is 'One row per outbound email. Tracks the full lifecycle from draft to reply. response_classification set by Claude Haiku on inbound replies.';

create index if not exists idx_email_threads_business_id on email_threads(business_id);
create index if not exists idx_email_threads_status on email_threads(status);
create index if not exists idx_email_threads_sent_at on email_threads(sent_at desc);


-- ============================================================
-- 10. DD DOCUMENTS
-- Files uploaded for due diligence (CIMs, financials, tax returns).
-- Actual files live in Supabase Storage — this table holds metadata.
-- ============================================================
create table if not exists dd_documents (
  id            uuid primary key default uuid_generate_v4(),
  business_id   uuid not null references businesses(id) on delete cascade,
  file_name     text not null,
  file_type     text not null check (file_type in ('pdf','docx','txt','xlsx')),
  storage_path  text not null,                                -- Supabase Storage bucket path
  doc_type      text not null
                  check (doc_type in ('cim','financials','tax_return','nda','other')),
  file_size_kb  int,
  uploaded_at   timestamptz not null default now()
);

comment on table dd_documents is 'Metadata for DD documents uploaded to Supabase Storage. Actual files stored in the dd-documents storage bucket.';

create index if not exists idx_dd_documents_business_id on dd_documents(business_id);


-- ============================================================
-- 11. DD MEMOS
-- AI-generated due diligence memos.
-- sections JSONB uses a fixed schema (Option A) — 8 named keys.
-- Multiple versions per business supported.
-- ============================================================
create table if not exists dd_memos (
  id                    uuid primary key default uuid_generate_v4(),
  business_id           uuid not null references businesses(id) on delete cascade,
  source_doc_ids        uuid[],                               -- references dd_documents.id
  version               smallint not null default 1,
  model_used            text not null default 'claude-opus-4-6',

  -- Fixed schema sections (Option A)
  -- Each section has: summary (text), flags (text[]), criteria (jsonb[]), not_disclosed (text[])
  sections              jsonb not null default '{
    "business_overview":    {"summary": null, "flags": [], "criteria": [], "not_disclosed": []},
    "financial_profile":    {"summary": null, "flags": [], "criteria": [], "not_disclosed": []},
    "management_team":      {"summary": null, "flags": [], "criteria": [], "not_disclosed": []},
    "customer_analysis":    {"summary": null, "flags": [], "criteria": [], "not_disclosed": []},
    "operations":           {"summary": null, "flags": [], "criteria": [], "not_disclosed": []},
    "market_position":      {"summary": null, "flags": [], "criteria": [], "not_disclosed": []},
    "deal_breaker_check":   {"fired": false, "conditions_evaluated": 6, "flags": [], "not_disclosed": []},
    "anacapa_fit_scorecard":{"quadrant_1": null, "quadrant_2": null, "quadrant_3": null, "quadrant_4": null}
  }'::jsonb,

  user_annotations      jsonb not null default '{}',          -- keyed by section name
  risk_flags            text[] not null default '{}',
  deal_breaker_fired    boolean not null default false,
  investment_thesis     text,
  open_questions        text[],                               -- prioritized list for management interview
  suggested_next_step   text
                          check (suggested_next_step in (
                            'advance_to_mgmt_call','request_financials',
                            'request_customer_refs','pass','pending'
                          )),

  generated_at          timestamptz not null default now(),
  exported_at           timestamptz,
  export_format         text check (export_format in ('pdf','docx'))
);

comment on table dd_memos is 'AI-generated DD memos. sections uses a fixed 8-key JSONB schema (Option A). Multiple versions per business. deal_breaker_fired = true triggers red header in the UI.';
comment on column dd_memos.sections is 'Fixed 8-section schema. Keys: business_overview, financial_profile, management_team, customer_analysis, operations, market_position, deal_breaker_check, anacapa_fit_scorecard.';

create index if not exists idx_dd_memos_business_id on dd_memos(business_id);
create index if not exists idx_dd_memos_deal_breaker on dd_memos(deal_breaker_fired) where deal_breaker_fired = true;


-- ============================================================
-- TRIGGERS
-- Keep last_activity_at on businesses in sync automatically.
-- Keep updated_at current on mutable tables.
-- ============================================================

-- Generic updated_at trigger function
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply updated_at trigger to mutable tables
create trigger trg_businesses_updated_at
  before update on businesses
  for each row execute function set_updated_at();

create trigger trg_contacts_updated_at
  before update on contacts
  for each row execute function set_updated_at();

create trigger trg_email_threads_updated_at
  before update on email_threads
  for each row execute function set_updated_at();

create trigger trg_user_settings_updated_at
  before update on user_settings
  for each row execute function set_updated_at();

-- Sync last_activity_at on businesses when an activity is inserted
create or replace function sync_last_activity_at()
returns trigger language plpgsql as $$
begin
  update businesses
  set last_activity_at = new.created_at
  where id = new.business_id;
  return new;
end;
$$;

create trigger trg_sync_last_activity
  after insert on activities
  for each row execute function sync_last_activity_at();


-- ============================================================
-- ROW LEVEL SECURITY
-- Single-user app — policies allow the authenticated user
-- to read and write all rows they own.
-- ============================================================

alter table businesses              enable row level security;
alter table business_classifications enable row level security;
alter table contacts                enable row level security;
alter table activities              enable row level security;
alter table email_templates         enable row level security;
alter table email_threads           enable row level security;
alter table dd_documents            enable row level security;
alter table dd_memos                enable row level security;
alter table user_settings           enable row level security;
alter table hierarchy_taxonomy      enable row level security;
alter table naics_benchmarks        enable row level security;

-- Single authenticated user can do everything
-- (expand these if you ever add team members)

create policy "auth_all_businesses"
  on businesses for all to authenticated using (true) with check (true);

create policy "auth_all_classifications"
  on business_classifications for all to authenticated using (true) with check (true);

create policy "auth_all_contacts"
  on contacts for all to authenticated using (true) with check (true);

create policy "auth_all_activities"
  on activities for all to authenticated using (true) with check (true);

create policy "auth_all_email_templates"
  on email_templates for all to authenticated using (true) with check (true);

create policy "auth_all_email_threads"
  on email_threads for all to authenticated using (true) with check (true);

create policy "auth_all_dd_documents"
  on dd_documents for all to authenticated using (true) with check (true);

create policy "auth_all_dd_memos"
  on dd_memos for all to authenticated using (true) with check (true);

create policy "auth_own_settings"
  on user_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "auth_read_hierarchy"
  on hierarchy_taxonomy for select to authenticated using (true);

create policy "auth_read_benchmarks"
  on naics_benchmarks for select to authenticated using (true);


-- ============================================================
-- STORAGE BUCKET
-- Run this separately in the Supabase dashboard Storage tab
-- OR uncomment and run here if using the CLI.
-- ============================================================

-- insert into storage.buckets (id, name, public)
-- values ('dd-documents', 'dd-documents', false);

-- create policy "auth_dd_storage"
--   on storage.objects for all to authenticated
--   using (bucket_id = 'dd-documents') with check (bucket_id = 'dd-documents');


-- ============================================================
-- DONE
-- Tables created: 11
-- Triggers: 5
-- RLS policies: 12
-- ============================================================
