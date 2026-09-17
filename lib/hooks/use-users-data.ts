import useSWR from 'swr';
import type { PostgrestError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import {
  normalizeProfile,
  PROFILE_ROLES_EMBED,
  type AccountKind,
  type ProfileRole,
  type RawProfileRoles,
} from '@/lib/utils/access';

export interface Member {
  id: string;
  given_name: string;
  family_name?: string | null;
  alias?: string | null;
  full_name: string;
  display_name: string;
  kind: AccountKind;
  roles: ProfileRole[];
  created_at: string;
  avatar_url?: string | null;
}

/** Fila tal como llega de PostgREST; sin tipos generados hay que fijarla a mano. */
type RawMember = Omit<Member, 'roles'> & RawProfileRoles;

interface UseUsersDataReturn {
  users: Member[];
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

const fetchUsersData = async (): Promise<Member[]> => {
  const supabase = createClient();
  // Sin tipos generados, `from()` devuelve `any` y no admite `.overrideTypes<>()`
  // (TS2347): la fila se fija anotando el resultado.
  const { data, error }: { data: RawMember[] | null; error: PostgrestError | null } = await supabase
    .from('profiles')
    .select(
      `id, given_name, family_name, alias, full_name, display_name, kind, created_at, avatar_url, ${PROFILE_ROLES_EMBED}`
    )
    .eq('kind', 'AGENCIA')
    .eq('is_dev', false)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((raw) => normalizeProfile(raw) as Member);
};

/** Miembros de la agencia. Solo quien invita o gestiona roles lo pide. */
export function useUsersData(): UseUsersDataReturn {
  const { access, status } = useAuth();
  const allowed =
    status === 'AUTHENTICATED' && (access.can('invitar_personal') || access.can('gestionar_roles'));

  const { data, error, isLoading, mutate } = useSWR<Member[]>(allowed ? 'users-data' : null, fetchUsersData);

  return { users: data ?? [], isLoading, error: error ?? null, mutate };
}
