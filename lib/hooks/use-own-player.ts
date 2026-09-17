'use client';

import useSWR from 'swr';
import type { PostgrestError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';

export interface OwnPlayer {
  id: string;
  full_name: string;
  active: boolean;
}

async function fetchOwnPlayer([, userId]: [string, string]): Promise<OwnPlayer | null> {
  const supabase = createClient();
  // La RLS ya limita a la propia ficha; el filtro es por claridad y por si
  // algún día un miembro de la agencia también tiene ficha.
  const { data, error }: { data: OwnPlayer | null; error: PostgrestError | null } = await supabase
    .from('players')
    .select('id, full_name, active')
    .eq('profile_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** La ficha del jugador que ha iniciado sesión, o null si no la tiene. */
export function useOwnPlayer() {
  const { status, user, profile } = useAuth();
  const allowed = status === 'AUTHENTICATED' && !!user && profile?.kind === 'JUGADOR';
  const { data, error, isLoading, mutate } = useSWR<OwnPlayer | null>(
    allowed ? ['own-player', user.id] : null,
    fetchOwnPlayer
  );
  return { player: data ?? null, isLoading, error: error ?? null, mutate };
}
