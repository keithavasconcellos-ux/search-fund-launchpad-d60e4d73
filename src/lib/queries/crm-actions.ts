import { supabase } from '@/integrations/supabase/client'

/** Mark a business as in_crm = true and set stage to 'identified' */
export async function addToCrm(businessId: string) {
  const { error } = await supabase
    .from('businesses')
    .update({ in_crm: true, crm_stage: 'identified' } as any)
    .eq('id', businessId)

  if (error) throw error
}
