import { supabase } from '@/integrations/supabase/client';

export type MemoCriterion = {
  label: string;
  value: string | null;
  status: 'green' | 'yellow' | 'red' | 'not_disclosed';
};

export type MemoSection = {
  summary: string | null;
  flags: string[];
  criteria: MemoCriterion[];
  not_disclosed: string[];
};

export type Risk = {
  label: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  mitigant: string;
};

export type Quadrant = 'green' | 'yellow' | 'red' | null;

export type MemoSections = {
  business_overview: MemoSection;
  financial_profile: MemoSection;
  management_team: MemoSection;
  customer_analysis: MemoSection;
  operations: MemoSection;
  market_position: MemoSection;
  deal_breaker_check: {
    fired: boolean;
    conditions_evaluated: number;
    flags: string[];
    not_disclosed: string[];
  };
  anacapa_fit_scorecard: {
    quadrant_1: Quadrant;
    quadrant_2: Quadrant;
    quadrant_3: Quadrant;
    quadrant_4: Quadrant;
    descriptors?: {
      quadrant_1: string;
      quadrant_2: string;
      quadrant_3: string;
      quadrant_4: string;
    };
  };
  risk_register?: Risk[];
  investment_thesis?: {
    thesis: string;
    bull_case: string[];
    bear_case: string[];
    next_steps: string[];
  };
};

export type DDMemo = {
  id: string;
  business_id: string;
  version: number;
  model_used: string;
  sections: MemoSections;
  risk_flags: string[];
  deal_breaker_fired: boolean;
  investment_thesis: string | null;
  open_questions: string[] | null;
  suggested_next_step: string | null;
  generated_at: string;
  analysis_label: string | null;
  input_type: string | null;
  input_page_count: number | null;
  confidence_level: 'low' | 'medium' | 'high' | null;
  additional_context: string | null;
};

export async function getCrmBusinessesForLinking() {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, address, state, in_crm, business_classifications(vertical)')
    .eq('in_crm', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((b: any) => ({
    id: b.id,
    name: b.name,
    address: b.address as string | null,
    state: b.state as string | null,
    vertical: b.business_classifications?.[0]?.vertical ?? null,
  }));
}

export async function getMemosForBusiness(businessId: string): Promise<DDMemo[]> {
  const { data, error } = await supabase
    .from('dd_memos')
    .select('*')
    .eq('business_id', businessId)
    .order('version', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DDMemo[];
}

export async function getAllMemos(): Promise<(DDMemo & { business: { name: string; crm_stage: string | null; vertical: string | null } })[]> {
  const { data, error } = await supabase
    .from('dd_memos')
    .select('*, business:businesses!inner(name, crm_stage, business_classifications(vertical))')
    .order('generated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((m: any) => ({
    ...m,
    business: {
      name: m.business?.name ?? 'Unknown',
      crm_stage: m.business?.crm_stage ?? null,
      vertical: m.business?.business_classifications?.[0]?.vertical ?? null,
    },
  })) as any;
}

export async function deleteMemo(id: string) {
  const { error } = await supabase.from('dd_memos').delete().eq('id', id);
  if (error) throw error;
}

export async function extractCimBusiness(args: {
  name: string;
  file: File;
}): Promise<{ business: { id: string; name: string }; cim_text_dump: string; confidence: string }> {
  // Upload to storage first to avoid sending huge JSON payloads through the function gateway
  const ext = args.file.name.split('.').pop() || 'pdf';
  const storage_path = `cim-staging/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('dd-documents')
    .upload(storage_path, args.file, {
      contentType: args.file.type || 'application/pdf',
      upsert: false,
    });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  const { data, error } = await supabase.functions.invoke('extract-cim-business', {
    body: {
      name: args.name,
      storage_path,
      file_mime: args.file.type || 'application/pdf',
      file_name: args.file.name,
    },
  });

  // Best-effort cleanup of the staged upload
  supabase.storage.from('dd-documents').remove([storage_path]).catch(() => {});

  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

export async function generateMemo(args: {
  business_id: string;
  input_type: 'cim' | 'call_notes' | 'name_only';
  input_text?: string;
  analysis_label?: string;
  additional_context?: string;
  page_count?: number;
}): Promise<DDMemo> {
  const { data, error } = await supabase.functions.invoke('generate-dd-memo', { body: args });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return (data as any).memo as DDMemo;
}
