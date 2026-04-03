export type CrmStage = 'Identified' | 'Contacted' | 'Engaged' | 'NDA Signed' | 'CIM Received' | 'IOI Submitted' | 'LOI Active' | 'Under LOI' | 'Passed' | 'Dead';
export type ReviewStatus = 'Target' | 'Non-Target' | 'Not Yet Reviewed';
export type NaicsConfidence = 'High' | 'Medium' | 'Needs Review';

export interface Business {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  naicsCode: string;
  naicsLabel: string;
  naicsConfidence: NaicsConfidence;
  rating: number;
  reviewCount: number;
  employeeCount: number | null;
  reviewStatus: ReviewStatus;
  revenueEstLow: number | null;
  revenueEstHigh: number | null;
  revenueEstConfidence: 'High' | 'Medium' | 'Low' | null;
  crmStage: CrmStage | null;
  dealConfidenceScore: number | null;
  website: string | null;
  phone: string | null;
  foundedYear: number | null;
  distanceMi: number | null;
  lastContactedAt: string | null;
  createdAt: string;
  owner: string | null;
}

export interface Contact {
  id: string;
  businessId: string;
  name: string;
  role: string;
  email: string;
  phone: string | null;
  isOwner: boolean;
}

export interface ActivityItem {
  id: string;
  type: 'email_sent' | 'reply_received' | 'stage_change' | 'note_added' | 'cim_uploaded' | 'dd_memo';
  description: string;
  timestamp: string;
  businessName?: string;
}

export const mockBusinesses: Business[] = [
  {
    id: '1', name: 'Lakeside HVAC Services', address: '45 Industrial Blvd', city: 'Waltham', state: 'MA', zip: '02451',
    naicsCode: '238220', naicsLabel: 'HVAC', naicsConfidence: 'High', rating: 4.7, reviewCount: 312,
    employeeCount: 22, reviewStatus: 'Target', revenueEstLow: 3500000, revenueEstHigh: 5000000,
    revenueEstConfidence: 'Medium', crmStage: 'Engaged', dealConfidenceScore: 72, website: 'lakesidehvac.com',
    phone: '(781) 555-0142', foundedYear: 1998, distanceMi: 12.4, lastContactedAt: '2025-11-08', createdAt: '2025-09-15',
    owner: 'Bob Callahan',
  },
  {
    id: '2', name: 'Green Valley HVAC', address: '88 Commerce Rd', city: 'Newton', state: 'MA', zip: '02458',
    naicsCode: '238220', naicsLabel: 'HVAC', naicsConfidence: 'High', rating: 4.5, reviewCount: 189,
    employeeCount: 15, reviewStatus: 'Target', revenueEstLow: 2400000, revenueEstHigh: 3300000,
    revenueEstConfidence: 'Medium', crmStage: 'Contacted', dealConfidenceScore: 58, website: 'greenvalleyhvac.com',
    phone: '(617) 555-0233', foundedYear: 2003, distanceMi: 8.1, lastContactedAt: '2025-11-06', createdAt: '2025-09-20',
    owner: 'Mike Chen',
  },
  {
    id: '3', name: 'Premier Pest Control', address: '12 Oak St', city: 'Framingham', state: 'MA', zip: '01701',
    naicsCode: '561710', naicsLabel: 'Pest Control', naicsConfidence: 'High', rating: 4.3, reviewCount: 245,
    employeeCount: 18, reviewStatus: 'Target', revenueEstLow: 2200000, revenueEstHigh: 3600000,
    revenueEstConfidence: 'Medium', crmStage: 'NDA Signed', dealConfidenceScore: 65, website: 'premierpest.com',
    phone: '(508) 555-0178', foundedYear: 2001, distanceMi: 22.3, lastContactedAt: '2025-11-06', createdAt: '2025-10-01',
    owner: 'Sarah Mitchell',
  },
  {
    id: '4', name: 'Harbor Plumbing Inc', address: '300 Marina Way', city: 'Quincy', state: 'MA', zip: '02169',
    naicsCode: '238220', naicsLabel: 'Plumbing', naicsConfidence: 'High', rating: 4.6, reviewCount: 178,
    employeeCount: 12, reviewStatus: 'Target', revenueEstLow: 1900000, revenueEstHigh: 2600000,
    revenueEstConfidence: 'Medium', crmStage: 'Contacted', dealConfidenceScore: 52, website: 'harborplumbing.com',
    phone: '(617) 555-0391', foundedYear: 2005, distanceMi: 14.7, lastContactedAt: '2025-11-04', createdAt: '2025-09-28',
    owner: 'Dan Torres',
  },
  {
    id: '5', name: 'Tri-State Plumbing Co', address: '65 Main St', city: 'Natick', state: 'MA', zip: '01760',
    naicsCode: '238220', naicsLabel: 'Plumbing', naicsConfidence: 'High', rating: 4.4, reviewCount: 156,
    employeeCount: 10, reviewStatus: 'Target', revenueEstLow: 1600000, revenueEstHigh: 2200000,
    revenueEstConfidence: 'Medium', crmStage: 'Engaged', dealConfidenceScore: 61, website: 'tristateplumbing.com',
    phone: '(508) 555-0264', foundedYear: 2008, distanceMi: 18.9, lastContactedAt: '2025-11-05', createdAt: '2025-10-05',
    owner: 'Jim Walsh',
  },
  {
    id: '6', name: 'Northeast Electrical Services', address: '410 Tech Park Dr', city: 'Burlington', state: 'MA', zip: '01803',
    naicsCode: '238210', naicsLabel: 'Electrical', naicsConfidence: 'High', rating: 4.8, reviewCount: 290,
    employeeCount: 28, reviewStatus: 'Target', revenueEstLow: 4200000, revenueEstHigh: 6200000,
    revenueEstConfidence: 'High', crmStage: 'CIM Received', dealConfidenceScore: 78, website: 'northeastelectrical.com',
    phone: '(781) 555-0445', foundedYear: 1995, distanceMi: 16.2, lastContactedAt: '2025-11-07', createdAt: '2025-09-10',
    owner: 'Tom Richards',
  },
  {
    id: '7', name: 'AllStar Roofing', address: '99 Summit Ave', city: 'Watertown', state: 'MA', zip: '02472',
    naicsCode: '238160', naicsLabel: 'Roofing', naicsConfidence: 'High', rating: 4.2, reviewCount: 98,
    employeeCount: 14, reviewStatus: 'Not Yet Reviewed', revenueEstLow: 2000000, revenueEstHigh: 3100000,
    revenueEstConfidence: 'Low', crmStage: 'Identified', dealConfidenceScore: null, website: 'allstarroofing.com',
    phone: '(617) 555-0512', foundedYear: 2010, distanceMi: 6.3, lastContactedAt: null, createdAt: '2025-10-12',
    owner: null,
  },
  {
    id: '8', name: 'Boston Drain & Sewer', address: '15 Canal St', city: 'Boston', state: 'MA', zip: '02114',
    naicsCode: '238220', naicsLabel: 'Plumbing', naicsConfidence: 'Medium', rating: 4.1, reviewCount: 67,
    employeeCount: 8, reviewStatus: 'Not Yet Reviewed', revenueEstLow: 1200000, revenueEstHigh: 1800000,
    revenueEstConfidence: 'Low', crmStage: null, dealConfidenceScore: null, website: null,
    phone: '(617) 555-0601', foundedYear: 2012, distanceMi: 3.1, lastContactedAt: null, createdAt: '2025-10-18',
    owner: null,
  },
  {
    id: '9', name: 'Precision Landscaping', address: '220 Garden Rd', city: 'Wellesley', state: 'MA', zip: '02482',
    naicsCode: '561730', naicsLabel: 'Landscaping', naicsConfidence: 'High', rating: 4.9, reviewCount: 410,
    employeeCount: 35, reviewStatus: 'Target', revenueEstLow: 3800000, revenueEstHigh: 5500000,
    revenueEstConfidence: 'High', crmStage: 'Contacted', dealConfidenceScore: 55, website: 'precisionlandscaping.com',
    phone: '(781) 555-0722', foundedYear: 1992, distanceMi: 15.0, lastContactedAt: '2025-11-03', createdAt: '2025-09-25',
    owner: 'Lisa Park',
  },
  {
    id: '10', name: 'Metro Fire Protection', address: '78 Safety Ln', city: 'Brockton', state: 'MA', zip: '02301',
    naicsCode: '238290', naicsLabel: 'Specialty Trade', naicsConfidence: 'Medium', rating: 4.0, reviewCount: 42,
    employeeCount: 20, reviewStatus: 'Non-Target', revenueEstLow: 3000000, revenueEstHigh: 4400000,
    revenueEstConfidence: 'Medium', crmStage: 'Passed', dealConfidenceScore: 30, website: 'metrofire.com',
    phone: '(508) 555-0831', foundedYear: 2000, distanceMi: 28.5, lastContactedAt: '2025-10-20', createdAt: '2025-09-30',
    owner: 'Ray Johnson',
  },
];

export const mockActivities: ActivityItem[] = [
  { id: '1', type: 'reply_received', description: 'Positive reply from Lakeside HVAC Services', timestamp: '2025-11-08T14:30:00Z', businessName: 'Lakeside HVAC Services' },
  { id: '2', type: 'email_sent', description: '34 emails sent to Plumbing segment', timestamp: '2025-11-08T12:00:00Z' },
  { id: '3', type: 'cim_uploaded', description: 'CIM uploaded for Premier Pest Control', timestamp: '2025-11-07T16:00:00Z', businessName: 'Premier Pest Control' },
  { id: '4', type: 'dd_memo', description: 'DD Memo generated — 8 pages', timestamp: '2025-11-07T10:00:00Z', businessName: 'Northeast Electrical Services' },
  { id: '5', type: 'stage_change', description: 'Moved to NDA Signed', timestamp: '2025-11-06T09:00:00Z', businessName: 'Premier Pest Control' },
  { id: '6', type: 'email_sent', description: 'Letter 3 sent', timestamp: '2025-11-05T11:00:00Z', businessName: 'Tri-State Plumbing Co' },
];

export const pipelineStages: CrmStage[] = [
  'Identified', 'Contacted', 'Engaged', 'NDA Signed', 'CIM Received', 'IOI Submitted', 'LOI Active', 'Under LOI', 'Passed', 'Dead'
];

export function formatRevenue(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
}

export function getStageColor(stage: CrmStage): string {
  const colors: Record<CrmStage, string> = {
    'Identified': 'bg-muted text-muted-foreground',
    'Contacted': 'bg-primary/20 text-primary',
    'Engaged': 'bg-teal/20 text-teal',
    'NDA Signed': 'bg-purple/20 text-purple',
    'CIM Received': 'bg-cyan/20 text-cyan',
    'IOI Submitted': 'bg-warning/20 text-warning',
    'LOI Active': 'bg-success/20 text-success',
    'Under LOI': 'bg-success/30 text-success',
    'Passed': 'bg-muted text-text-tertiary',
    'Dead': 'bg-destructive/20 text-destructive',
  };
  return colors[stage];
}
