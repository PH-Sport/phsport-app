import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/lib/auth/auth-context';
import { toProfile, PROFILE_WITH_ROLES_SELECT } from '@/lib/utils/access';

export interface ServerAuth {
  user: User | null;
  profile: Profile | null;
}

/**
 * Resuelve sesión + perfil EN EL SERVIDOR → el AuthProvider arranca ya
 * autenticado, sin spinner en cliente (Fase 2). `cache()` lo resuelve una sola
 * vez por render aunque lo llamen el layout y un `loading.tsx`.
 *
 * NOTA: este `getUser()` + el del middleware validan la sesión dos veces por
 * request. Es intencionado (patrón SSR de Supabase); no lo "optimices":
 *   · getSession() → emite el aviso "insecure" de Supabase en cada request.
 *   · pasar el user por cabecera → no ahorra: la query de perfil (RLS) necesita
 *     la sesión cargada igualmente.
 *
 * Fallo seguro: ante error → { null, null } (el cliente reintenta en su init).
 */
export const getServerAuth = cache(async function getServerAuth(): Promise<ServerAuth> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return { user: null, profile: null };

    const { data: raw, error: profileError } = await supabase
      .from('profiles')
      .select(PROFILE_WITH_ROLES_SELECT)
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !raw) return { user, profile: null };

    return { user, profile: toProfile(raw) };
  } catch {
    return { user: null, profile: null };
  }
});
