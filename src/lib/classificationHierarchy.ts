/**
 * Static 4-level classification hierarchy sourced from search_fund_gbp_mapping_expanded.csv
 * L1: Vertical → L2: Category → L3: Business Type → L4: Primary GBP Category (string | null)
 *
 * Used by MapView drill-down filter and Library/Dashboard filters.
 * Update this file when the mapping spreadsheet changes.
 */

export type Hierarchy = Record<
  string,                          // L1 Vertical
  Record<
    string,                        // L2 Category
    Record<
      string,                      // L3 Business Type
      { primary: string | null; secondary: string[] }  // L4
    >
  >
>

export const CLASSIFICATION_HIERARCHY: Hierarchy = {
  "Business Services": {
    "Consumer Services": {
      "Auto repair & maintenance":            { primary: "Auto repair shop", secondary: ["Car dealer", "Oil change service", "Tire shop"] },
      "Funeral & cemetery services":          { primary: "Funeral home", secondary: ["Cemetery", "Cremation service"] },
      "Moving & junk removal":                { primary: "Moving company", secondary: ["Junk removal service", "Storage facility", "Truck rental agency"] },
      "Pet boarding & grooming":              { primary: "Pet groomer", secondary: ["Kennel", "Pet boarding service", "Veterinarian"] },
      "Residential services franchises":      { primary: "Repair service", secondary: ["Home improvement store", "House cleaning service", "Lawn care service"] },
      "Veterinary clinics":                   { primary: "Veterinarian", secondary: ["Animal hospital", "Pet boarding service", "Pet groomer"] },
    },
    "Education & Training": {
      "Corporate training providers":         { primary: "Training centre", secondary: ["Corporate campus", "Conference center"] },
      "Early childhood education (daycare)":  { primary: "Day care center", secondary: ["Preschool", "After school program", "Child care agency"] },
      "Test prep & tutoring centers":         { primary: "Tutoring service", secondary: ["Test preparation center", "Educational institution"] },
      "Vocational / trade schools":           { primary: "Vocational school", secondary: ["Trade school", "Technical school", "Adult education center"] },
    },
    "Facility & Specialty Services": {
      "Commercial cleaning & janitorial":     { primary: "Janitorial service", secondary: ["Building cleaning service", "House cleaning service", "Window cleaning service"] },
      "Electrical contractors":               { primary: "Electrician", secondary: ["Electrical installation service", "Electric utility company"] },
      "Fire & safety inspection":             { primary: "Fire protection service", secondary: ["Safety equipment supplier", "Security system supplier"] },
      "HVAC maintenance & service":           { primary: "HVAC contractor", secondary: ["Air conditioning repair service", "Heating contractor", "Furnace repair service"] },
      "Landscaping & grounds maintenance":    { primary: "Landscaper", secondary: ["Lawn care service", "Tree service", "Snow removal service"] },
      "Painting & surface contractors":       { primary: "Painter", secondary: ["Painting", "Pressure washing service", "Waterproofing service"] },
      "Pest control":                         { primary: "Pest control service", secondary: ["Exterminator", "Termite control service"] },
      "Plumbing & drain services":            { primary: "Plumber", secondary: ["Drainage service", "Septic system service", "Water treatment supplier"] },
      "Roofing & exterior contractors":       { primary: "Roofing contractor", secondary: ["Gutter cleaning service", "Siding contractor", "Waterproofing service"] },
      "Solar & renewable energy installation":{ primary: "Solar energy company", secondary: ["Solar energy equipment supplier", "Solar panel cleaning service"] },
      "Specialty trade contractors":          { primary: "General contractor", secondary: ["Construction company", "Remodeling contractor"] },
    },
    "Logistics & Distribution": {
      "Last-mile delivery services":          { primary: "Courier service", secondary: ["Delivery service", "Logistics service"] },
      "Specialty freight & hauling":          { primary: "Trucking company", secondary: ["Moving company", "Freight forwarding service", "Hauling service"] },
      "Third-party logistics (3PL)":          { primary: "Logistics service", secondary: ["Warehouse", "Freight forwarding service", "Distribution service"] },
    },
    "Professional & Business Services": {
      "Accounting & CPA firms":               { primary: "Accountant", secondary: ["Tax preparation service", "Bookkeeping service", "Financial consultant"] },
      "Commercial insurance brokerage":       { primary: "Insurance agency", secondary: ["Insurance broker", "Insurance company"] },
      "HR outsourcing (PEO)":                 { primary: "Human resources consulting", secondary: ["Employment agency", "Payroll service"] },
      "Payroll processing":                   { primary: "Payroll service", secondary: ["Bookkeeping service", "Accountant", "Business management consultant"] },
      "Tax preparation services":             { primary: "Tax preparation service", secondary: ["Accountant", "Financial consultant", "Bookkeeping service"] },
    },
  },
  "Healthcare": {
    "Behavioral & Mental Health": {
      "ABA therapy (autism)":                         { primary: "Therapist", secondary: ["Child psychologist", "Disability services and support organisation", "Special education school"] },
      "Outpatient behavioral health":                 { primary: "Mental health service", secondary: ["Psychiatrist", "Psychologist", "Counselor"] },
      "Substance abuse & addiction treatment":        { primary: "Addiction treatment center", secondary: ["Rehabilitation center", "Mental health service", "Drug testing service"] },
    },
    "Dental & Oral Health": {
      "Dental service organizations (DSO)":           { primary: "Dentist", secondary: ["Dental clinic", "Cosmetic dentist", "Pediatric dentist"] },
      "Oral surgery practices":                       { primary: "Oral surgeon", secondary: ["Dentist", "Periodontist", "Dental implants periodontist"] },
      "Orthodontics / Invisalign practices":          { primary: "Orthodontist", secondary: ["Dentist", "Pediatric dentist", "Cosmetic dentist"] },
    },
    "Healthcare Services & Admin": {
      "Diagnostic imaging centers":                   { primary: "Medical diagnostic imaging center", secondary: ["Radiologist", "MRI center", "X-ray lab"] },
      "Healthcare staffing (travel nursing)":         { primary: "Nursing agency", secondary: ["Employment agency", "Home health care service"] },
      "Medical billing & coding":                     { primary: "Medical billing service", secondary: ["Business management consultant", "Accountant"] },
      "Pharmacy benefit management (PBM)":            { primary: "Pharmacy", secondary: ["Drug store", "Health consultant"] },
    },
    "Physician & Clinical Services": {
      "Chiropractic & alternative medicine":          { primary: "Chiropractor", secondary: ["Acupuncturist", "Massage therapist", "Naturopath"] },
      "Dermatology practices":                        { primary: "Dermatologist", secondary: ["Skin care clinic", "Medical spa", "Plastic surgeon"] },
      "Nutrition & wellness counseling":              { primary: "Nutritionist", secondary: ["Dietitian", "Wellness program", "Weight loss service"] },
      "Ophthalmology / optometry practices":          { primary: "Optometrist", secondary: ["Ophthalmologist", "Eye care center", "Optician"] },
      "Orthopedic & sports medicine":                 { primary: "Orthopedic surgeon", secondary: ["Physical therapist", "Sports medicine clinic", "Pain management physician"] },
      "Primary care / concierge medicine":            { primary: "Family practice physician", secondary: ["General practitioner", "Internal medicine physician", "Medical clinic"] },
      "Specialty physician practices":                { primary: "Physician", secondary: ["Medical clinic", "Specialist"] },
      "Urgent care clinics":                          { primary: "Urgent care center", secondary: ["Walk-in clinic", "Emergency care physician", "Medical clinic"] },
    },
    "Post-Acute & Long-Term Care": {
      "Home health agencies":                         { primary: "Home health care service", secondary: ["Nursing agency", "Disability services and support organisation"] },
      "Hospice & palliative care":                    { primary: "Hospice", secondary: ["Palliative care", "Home health care service", "Nursing home"] },
      "Long-term acute care hospitals":               { primary: "Hospital", secondary: ["Rehabilitation center", "Nursing home", "Medical clinic"] },
      "Skilled nursing / rehab facilities":           { primary: "Nursing home", secondary: ["Rehabilitation center", "Physical therapist", "Home health care service"] },
    },
  },
  "Technology-Enabled Services": {
    "B2B SaaS & Vertical Software": {
      "ERP / practice management (niche)":            { primary: "Software company", secondary: ["Business management consultant", "IT service"] },
      "Field service management software":            { primary: "Software company", secondary: ["IT service", "Business management consultant"] },
      "Property management software":                 { primary: "Property management company", secondary: ["Software company", "Real estate agency"] },
      "Vertical market SaaS (SMB)":                   { primary: "Software company", secondary: ["IT service", "Internet service provider"] },
    },
    "Data, Analytics & Compliance": {
      "Compliance & regulatory tech":                 { primary: "Legal services", secondary: ["Consultant", "Business management consultant"] },
      "Engineering inspection software":              { primary: "Engineering consultant", secondary: ["Inspection service", "Software company"] },
      "Environmental data & reporting":               { primary: "Environmental consultant", secondary: ["Engineer", "Testing service"] },
      "GIS & mapping services":                       { primary: "Mapping service", secondary: ["Software company", "Engineer"] },
    },
    "Digital Marketing & Commerce": {
      "Digital marketing agencies (niche)":           { primary: "Marketing agency", secondary: ["Internet marketing service", "Advertising agency", "SEO agency"] },
      "E-commerce enablement services":               { primary: "E-commerce service", secondary: ["Marketing agency", "Software company", "Web designer"] },
      "SEO / content marketing platforms":            { primary: "SEO agency", secondary: ["Marketing agency", "Internet marketing service", "Advertising agency"] },
    },
    "Managed Services & IT": {
      "AV & unified communications":                  { primary: "Audio visual equipment supplier", secondary: ["Telecommunications service provider", "Business center"] },
      "Cloud migration & managed cloud":              { primary: "Cloud services", secondary: ["Data recovery service", "Software company", "IT service"] },
      "Cybersecurity services":                       { primary: "Computer security service", secondary: ["IT service", "Software company"] },
      "Managed IT / MSP":                             { primary: "Computer support and services", secondary: ["IT service", "Software company", "Computer repair service"] },
    },
    "Tech-Enabled BPO": {
      "Claims processing & administration":           { primary: "Insurance agency", secondary: ["Business management consultant", "Financial consultant"] },
      "Document management & imaging":                { primary: "Document management system", secondary: ["Filing service", "Data management service", "Printing service"] },
      "Outsourced finance & accounting (F&A)":        { primary: "Bookkeeping service", secondary: ["Accountant", "Financial consultant", "Tax preparation service"] },
      "Revenue cycle management (RCM)":               { primary: "Medical billing service", secondary: ["Business management consultant", "Accountant"] },
    },
  },
}

/** Returns just the L1→L2→L3 structure (no L4) — compatible with old getClassificationTaxonomy callers */
export function getTaxonomyFlat(): Record<string, Record<string, string[]>> {
  const out: Record<string, Record<string, string[]>> = {}
  for (const [v, cats] of Object.entries(CLASSIFICATION_HIERARCHY)) {
    out[v] = {}
    for (const [c, bts] of Object.entries(cats)) {
      out[v][c] = Object.keys(bts).sort()
    }
  }
  return out
}

/** L4: get primary GBP category options for a given L3 business type */
export function getPrimaryGbpCategories(vertical: string, category: string, businessType: string): string[] {
  const bt = CLASSIFICATION_HIERARCHY[vertical]?.[category]?.[businessType]
  if (!bt) return []
  return [bt.primary, ...bt.secondary].filter(Boolean) as string[]
}
