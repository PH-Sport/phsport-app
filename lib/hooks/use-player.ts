'use client';

import useSWR from 'swr';
import type { PostgrestError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { latestInvite, type PlayerFile } from '@/lib/utils/players';

/** Una ficha entera, con la cuenta enganchada (si la hay) y su enlace vivo. */
export interface PlayerDetail {
  id: string;
  given_name: string;
  family_name: string | null;
  full_name: string;
  active: boolean;
  profile_id: string | null;
  created_at: string;
  /** La cuenta, cuando existe: cómo se llama y desde cuándo. */
  account: { display_name: string; created_at: string } | null;
  invite: { id: string; token: string; expires_at: string | null; created_at: string } | null;
}

interface RawPlayerDetail {
  id: string;
  given_name: string;
  family_name: string | null;
  full_name: string;
  active: boolean;
  profile_id: string | null;
  created_at: string;
  account: { display_name: string; created_at: string } | null;
  invitations: { id: string; token: string; expires_at: string | null; created_at: string }[] | null;
}

// `players` tiene dos claves hacia `profiles` (la cuenta y quién creó la
// ficha): hay que decirle a PostgREST cuál seguir.
const PLAYER_DETAIL_SELECT =
  'id, given_name, family_name, full_name, active, profile_id, created_at, account:profiles!players_profile_id_fkey(display_name, created_at), invitations(id, token, expires_at, created_at)';

async function fetchPlayer([, id]: [string, string]): Promise<PlayerDetail | null> {
  const supabase = createClient();
  const { data, error }: { data: RawPlayerDetail | null; error: PostgrestError | null } = await supabase
    .from('players')
    .select(PLAYER_DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    given_name: data.given_name,
    family_name: data.family_name,
    full_name: data.full_name,
    active: data.active,
    profile_id: data.profile_id,
    created_at: data.created_at,
    account: data.account,
    invite: latestInvite(data.invitations),
  };
}

export function usePlayer(id: string | null) {
  const { status, access } = useAuth();
  const allowed = status === 'AUTHENTICATED' && access.inDepartment('creativo') && !!id;
  const { data, error, isLoading, mutate } = useSWR<PlayerDetail | null>(
    allowed ? ['player', id as string] : null,
    fetchPlayer
  );
  return { player: data ?? null, isLoading, error: error ?? null, mutate };
}

async function fetchPlayerFiles([, playerId]: [string, string]): Promise<PlayerFile[]> {
  const supabase = createClient();
  const { data, error }: { data: PlayerFile[] | null; error: PostgrestError | null } = await supabase
    .from('player_files')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Todos los archivos de una ficha. Lo usan la agencia y el propio jugador:
 * la RLS le devuelve a cada uno lo que le toca, así que la consulta es la misma.
 */
export function usePlayerFiles(playerId: string | null) {
  const { status } = useAuth();
  const { data, error, isLoading, mutate } = useSWR<PlayerFile[]>(
    status === 'AUTHENTICATED' && playerId ? ['player-files', playerId] : null,
    fetchPlayerFiles
  );
  return { files: data ?? [], isLoading, error: error ?? null, mutate };
}
