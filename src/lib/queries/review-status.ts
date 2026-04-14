import { supabase } from '@/integrations/supabase/client';
import type { ReviewStatus } from '@/types/acquira';

/**
 * Update review_status and sync CRM state:
 * - Setting 'target' → also adds to CRM (in_crm=true, crm_stage='identified' if not already set)
 * - Setting anything else → removes from CRM (in_crm=false)
 */
export async function updateReviewStatus(businessId: string, status: ReviewStatus) {
  const update: Record<string, any> = {
    review_status: status,
    review_status_set_at: new Date().toISOString(),
  };

  if (status === 'target') {
    // Auto-add to CRM when tagged as target
    // First check if already in CRM to preserve existing stage
    const { data } = await supabase
      .from('businesses')
      .select('in_crm')
      .eq('id', businessId)
      .single();

    if (!data?.in_crm) {
      update.in_crm = true;
      update.crm_stage = 'identified';
    }
  } else {
    // Remove from CRM when no longer a target
    update.in_crm = false;
  }

  const { error } = await supabase
    .from('businesses')
    .update(update as any)
    .eq('id', businessId);

  if (error) throw error;
}
