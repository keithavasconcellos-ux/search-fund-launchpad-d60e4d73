import { supabase } from '@/integrations/supabase/client'

/** Mark a business as in_crm = true, set stage to 'identified', and auto-set review_status to 'target' */
export async function addToCrm(businessId: string) {
  const { error } = await supabase
    .from('businesses')
    .update({
      in_crm: true,
      crm_stage: 'identified',
      review_status: 'target',
      review_status_set_at: new Date().toISOString(),
    } as any)
    .eq('id', businessId)

  if (error) throw error
}
