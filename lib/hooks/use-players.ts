'use client';

import useSWR from 'swr';
import type { PostgrestError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { folderCounts, latestInvite, type FolderView, type PlayerFile } from '@/lib/utils/players';

/** Una ficha en la lista de Jugadores, con lo justo para la segunda línea. */
export interface PlayerSummary {
  id: string;
  given_name: string;
  family_name: string | null;
  full_name: string;
  active: boolean;
  /** Nulo hasta que acepte el enlace. */
  profile_id: string | null;
  created_at: string;
  counts: Record<FolderView, number>;
  /** El enlace más reciente, si lo hay; caducado o no, lo decide quien lo lee. */
  invite: { id: string; token: string; expires_at: string | null } | null;
}

interface RawPlayerRow {
  id: string;
  given_name: string;
  family_name: string | null;
  full_name: string;
  active: boolean;
  profile_id: string | null;
  created_at: string;
  player_files: Pick<PlayerFile, 'folder'>[] | null;
  invitations: { id: string; token: string; expires_at: string | null }[] | null;
}

async function fetchPlayers(): Promise<PlayerSummary[]> {
  const supabase = createClient();
  // Sin tipos generados, `from()` devuelve `any`: la fila se fija a mano aquí.
  const { data, error }: { data: RawPlayerRow[] | null; error: PostgrestError | null } = await supabase
    .from('players')
    .select(
      'id, given_name, family_name, full_name, active, profile_id, created_at, player_files(folder), invitations(id, token, expires_at)'
    )
    .order('full_name', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((p) => ({
    id: p.id,
    given_name: p.given_name,
    family_name: p.family_name,
    full_name: p.full_name,
    active: p.active,
    profile_id: p.profile_id,
    created_at: p.created_at,
    counts: folderCounts((p.player_files ?? []) as PlayerFile[]),
    invite: latestInvite(p.invitations),
  }));
}

/** Las fichas de la cartera. Solo el departamento creativo (la RLS dice lo mismo). */
export function usePlayers() {
  const { status, access } = useAuth();
  const allowed = status === 'AUTHENTICATED' && access.inDepartment('creativo');
  const { data, error, isLoading, mutate } = useSWR<PlayerSummary[]>(allowed ? 'players' : null, fetchPlayers);
  return { players: data ?? [], isLoading, error: error ?? null, mutate };
}
