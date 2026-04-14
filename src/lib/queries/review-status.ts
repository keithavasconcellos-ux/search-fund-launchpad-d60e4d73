import { supabase } from '@/integrations/supabase/client';
import type { ReviewStatus } from '@/types/acquira';

/** Update the review_status of a business */
export async function updateReviewStatus(businessId: string, status: ReviewStatus) {
  const { error } = await supabase
    .from('businesses')
    .update({ review_status: status, review_status_set_at: new Date().toISOString() } as any)
    .eq('id', businessId);

  if (error) throw error;
}
