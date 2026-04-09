# Acquira — Antigravity Build Prompt
## Supabase Integration & Type Layer

---

You are working on **Acquira**, a search fund workflow tool built in React + TypeScript
with Supabase as the backend. The Supabase schema has already been created by running
a SQL migration. Your job is to wire the frontend to that schema.

---

## What was just created in Supabase

The following 11 tables now exist:

| Table | Purpose |
|---|---|
| `businesses` | Core entity — every tracked company |
| `business_classifications` | SF hierarchy classification (Vertical → Category → Business Type) |
| `contacts` | People associated with a business |
| `activities` | Append-only event log — all activity for all businesses |
| `email_templates` | Reusable outreach letter templates |
| `email_threads` | One row per email sent, tracks full lifecycle |
| `dd_documents` | Metadata for uploaded CIM/financial docs (files in Supabase Storage) |
| `dd_memos` | AI-generated DD memos with fixed 8-section JSONB schema |
| `hierarchy_taxonomy` | SF hierarchy reference table (Vertical → Category → Business Type + SF score) |
| `naics_benchmarks` | Revenue-per-employee benchmarks by business type |
| `user_settings` | Single-user settings including search_start_date for day counter |

---

## Task 1 — Supabase client setup

Ensure the Supabase client is initialized correctly. The environment variables are:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Create or verify `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

---

## Task 2 — Generate TypeScript types

Run the Supabase CLI to generate types from the live schema:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
```

Replace `YOUR_PROJECT_ID` with the project ID from the Supabase URL
(e.g. if the URL is `https://dzepmywtihvjgewdrynx.supabase.co` the ID is `dzepmywtihvjgewdrynx`).

If the CLI is not available, create `src/lib/database.types.ts` manually with the
type definitions below.

---

## Task 3 — TypeScript type definitions

Create `src/types/acquira.ts` with these application-level types:

```typescript
// CRM pipeline stages — must match the DB check constraint
export type CrmStage =
  | 'identified'
  | 'contacted'
  | 'engaged'
  | 'nda_signed'
  | 'cim_received'
  | 'active_loi'
  | 'passed'

export const CRM_STAGES: CrmStage[] = [
  'identified', 'contacted', 'engaged',
  'nda_signed', 'cim_received', 'active_loi', 'passed'
]

export const CRM_STAGE_LABELS: Record<CrmStage, string> = {
  identified:   'Identified',
  contacted:    'Contacted',
  engaged:      'Engaged',
  nda_signed:   'NDA Signed',
  cim_received: 'CIM Received',
  active_loi:   'Active LOI',
  passed:       'Passed'
}

// Review / targeting status
export type ReviewStatus = 'unreviewed' | 'target' | 'watch' | 'pass'

// Classification confidence
export type GbpConfidence = 'High' | 'Medium' | 'Low'

// Activity event types
export type ActivityType =
  | 'stage_change'
  | 'note'
  | 'email_sent'
  | 'email_opened'
  | 'email_replied'
  | 'cim_uploaded'
  | 'memo_generated'
  | 'contact_added'
  | 'status_change'
  | 'manual'

// Email status lifecycle
export type EmailStatus = 'draft' | 'sent' | 'opened' | 'replied' | 'bounced' | 'unsubscribed'

// Email response classification (set by Claude Haiku)
export type ResponseClassification =
  | 'positive'
  | 'negative'
  | 'neutral'
  | 'out_of_office'
  | 'not_classified'

// DD Memo sections — fixed 8-key schema (Option A)
export interface MemoSection {
  summary: string | null
  flags: string[]
  criteria: Array<{
    label: string
    value: string | null
    status: 'green' | 'yellow' | 'red' | 'not_disclosed'
  }>
  not_disclosed: string[]
}

export interface DealBreakerSection {
  fired: boolean
  conditions_evaluated: number
  flags: string[]
  not_disclosed: string[]
}

export interface AnacapaScorecard {
  quadrant_1: 'green' | 'yellow' | 'red' | null  // Business quality
  quadrant_2: 'green' | 'yellow' | 'red' | null  // Financial profile
  quadrant_3: 'green' | 'yellow' | 'red' | null  // Management
  quadrant_4: 'green' | 'yellow' | 'red' | null  // Deal structure
}

export interface MemoSections {
  business_overview:    MemoSection
  financial_profile:    MemoSection
  management_team:      MemoSection
  customer_analysis:    MemoSection
  operations:           MemoSection
  market_position:      MemoSection
  deal_breaker_check:   DealBreakerSection
  anacapa_fit_scorecard: AnacapaScorecard
}

// Business with its classification joined
export interface BusinessWithClassification {
  id: string
  place_id: string | null
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  website: string | null
  phone: string | null
  rating: number | null
  review_count: number | null
  employee_count: number | null
  founded_year: number | null
  crm_stage: CrmStage
  review_status: ReviewStatus
  revenue_est_low: number | null
  revenue_est_high: number | null
  revenue_confidence: 'low' | 'medium' | 'high' | null
  website_score: number | null
  deal_confidence_score: number | null
  last_activity_at: string | null
  created_at: string
  classification: {
    vertical: string | null
    category: string | null
    business_type: string | null
    gbp_confidence: GbpConfidence | null
    sf_score: number | null
  } | null
}
```

---

## Task 4 — Data access layer (queries)

Create `src/lib/queries/businesses.ts`:

```typescript
import { supabase } from '../supabase'
import type { CrmStage, ReviewStatus } from '../../types/acquira'

// Fetch businesses with their classification joined
// Used by: Library table, Map View, Dashboard
export async function getBusinesses(filters?: {
  crm_stage?: CrmStage
  vertical?: string
  sf_score_min?: number
  review_status?: ReviewStatus
  search?: string
  limit?: number
  offset?: number
}) {
  let query = supabase
    .from('businesses')
    .select(`
      *,
      classification:business_classifications(
        vertical, category, business_type, gbp_confidence, sf_score
      )
    `)
    .order('last_activity_at', { ascending: false, nullsFirst: false })

  if (filters?.crm_stage)      query = query.eq('crm_stage', filters.crm_stage)
  if (filters?.review_status)  query = query.eq('review_status', filters.review_status)
  if (filters?.search)         query = query.ilike('name', `%${filters.search}%`)
  if (filters?.limit)          query = query.limit(filters.limit)
  if (filters?.offset)         query = query.range(filters.offset, (filters.offset + (filters.limit ?? 50)) - 1)

  const { data, error } = await query
  if (error) throw error
  return data
}

// Fetch a single business with all related data
export async function getBusinessById(id: string) {
  const { data, error } = await supabase
    .from('businesses')
    .select(`
      *,
      classification:business_classifications(*),
      contacts(*),
      activities(* order by created_at desc limit 20),
      email_threads(* order by sent_at desc),
      dd_documents(*),
      dd_memos(* order by version desc limit 1)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

// Update CRM stage and log to activities
export async function updateCrmStage(
  businessId: string,
  fromStage: CrmStage,
  toStage: CrmStage,
  userId: string
) {
  const { error: bizError } = await supabase
    .from('businesses')
    .update({ crm_stage: toStage })
    .eq('id', businessId)

  if (bizError) throw bizError

  const { error: actError } = await supabase
    .from('activities')
    .insert({
      business_id: businessId,
      type: 'stage_change',
      from_stage: fromStage,
      to_stage: toStage,
      body: `Stage moved from ${fromStage} to ${toStage}`,
      created_by: userId
    })

  if (actError) throw actError
}

// Add a note
export async function addNote(
  businessId: string,
  body: string,
  userId: string
) {
  const { error } = await supabase
    .from('activities')
    .insert({
      business_id: businessId,
      type: 'note',
      body,
      created_by: userId
    })

  if (error) throw error
}
```

Create `src/lib/queries/dashboard.ts`:

```typescript
import { supabase } from '../supabase'

// Pipeline funnel counts — one query, grouped by stage
export async function getPipelineFunnelCounts() {
  const { data, error } = await supabase
    .from('businesses')
    .select('crm_stage')

  if (error) throw error

  const counts: Record<string, number> = {}
  data.forEach(row => {
    counts[row.crm_stage] = (counts[row.crm_stage] ?? 0) + 1
  })
  return counts
}

// Dashboard KPIs
export async function getDashboardKpis(periodDays: number = 7) {
  const since = new Date()
  since.setDate(since.getDate() - periodDays)
  const sinceISO = since.toISOString()

  const [businessCount, emailStats, recentActivity] = await Promise.all([
    supabase.from('businesses').select('id', { count: 'exact', head: true }),
    supabase.from('email_threads')
      .select('status, response_classification')
      .gte('sent_at', sinceISO),
    supabase.from('activities')
      .select('*, businesses(name, crm_stage)')
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: false })
      .limit(10)
  ])

  const totalEmails = emailStats.data?.length ?? 0
  const replies = emailStats.data?.filter(e => e.status === 'replied').length ?? 0
  const positiveReplies = emailStats.data?.filter(e => e.response_classification === 'positive').length ?? 0

  return {
    total_businesses: businessCount.count ?? 0,
    emails_sent: totalEmails,
    reply_rate: totalEmails > 0 ? (replies / totalEmails) : 0,
    positive_rate: totalEmails > 0 ? (positiveReplies / totalEmails) : 0,
    recent_activity: recentActivity.data ?? []
  }
}

// Needs attention — businesses in late stages with no recent activity
export async function getNeedsAttention() {
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  const { data, error } = await supabase
    .from('businesses')
    .select(`
      id, name, crm_stage, last_activity_at,
      classification:business_classifications(business_type)
    `)
    .in('crm_stage', ['engaged', 'nda_signed', 'active_loi'])
    .order('last_activity_at', { ascending: true })
    .limit(10)

  if (error) throw error
  return data
}
```

---

## Task 5 — Storage bucket

In the Supabase dashboard, go to Storage and create a bucket named `dd-documents`
with public access set to OFF (private). This is where CIM PDFs and financial
documents will be uploaded.

---

## Task 6 — Environment variables

Ensure the following are set in `.env.local` (never commit this file):

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

And in your production deployment environment (Vercel / Netlify / Lovable hosting)
add the same two variables in the environment settings dashboard.

---

## What NOT to do

- Do not create mock data or placeholder arrays — all data comes from Supabase
- Do not use localStorage for any business, contact, or activity data
- Do not hardcode CRM stage names as strings anywhere except the type definitions
  in `acquira.ts` — always reference `CRM_STAGES` or `CRM_STAGE_LABELS`
- Do not build the Gmail integration yet — that is a later phase
- Do not build the DD Agent AI calls yet — scaffold the UI but leave the
  Anthropic API calls as TODO stubs

---

## Build order

Build these in order. Do not skip ahead.

1. Supabase client + types (Tasks 1–3)
2. Query functions (Task 4)
3. Wire the existing Library page to use `getBusinesses()`
4. Wire the existing CRM Kanban to use `getBusinesses()` grouped by `crm_stage`
   and `updateCrmStage()` on drag-drop
5. Wire the existing Dashboard to use `getDashboardKpis()` and `getPipelineFunnelCounts()`
6. Wire the business record slide-over panel to use `getBusinessById()`

After each step, confirm data is flowing before moving to the next.
