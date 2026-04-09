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
