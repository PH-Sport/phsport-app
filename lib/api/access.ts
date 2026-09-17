import type { SupabaseClient } from '@supabase/supabase-js';
import { deriveAccess, toProfile, PROFILE_WITH_ROLES_SELECT, type Access } from '@/lib/utils/access';

/**
 * Permisos del usuario que llama, leídos bajo su propia RLS. Una cuenta sin
 * roles obtiene un Access vacío, que es exactamente lo que le corresponde.
 */
export async function loadAccess(supabase: SupabaseClient, userId: string): Promise<Access> {
  const { data } = await supabase
    .from('profiles')
    .select(PROFILE_WITH_ROLES_SELECT)
    .eq('id', userId)
    .maybeSingle();
  return deriveAccess(data ? toProfile(data) : null);
}
