'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { assignableProfiles } from '@/lib/services/profiles/assignable';
import { normalizeProfile, PROFILE_ROLES_EMBED, type ProfileRole, type RawProfileRoles } from '@/lib/utils/access';

type DesignerRow = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
} & RawProfileRoles;

export interface Designer {
  id: string;
  /** Nombre completo (Nombre + Primer apellido). Gestión / compat. */
  name: string;
  /** Nombre corto para el día a día (alias || given_name). */
  displayName: string;
  avatar_url?: string;
  /** Sus roles: «Ver como» los copia para simular su cara de la app. */
  roles: ProfileRole[];
}

async function fetchDesigners(): Promise<Designer[]> {
  const supabase = createClient();
  // Quien tiene el permiso de recibir asignaciones, bajo la RLS del llamante.
  const { data, error } = await assignableProfiles<DesignerRow>(
    supabase,
    `id, full_name, display_name, avatar_url, ${PROFILE_ROLES_EMBED}`
  );

  if (error) throw error;

  return (data || []).map((raw) => {
    const p = normalizeProfile(raw);
    return {
      id: p.id,
      name: p.full_name || 'Sin nombre',
      displayName: p.display_name || p.full_name || 'Sin nombre',
      avatar_url: p.avatar_url ?? undefined,
      roles: p.roles,
    };
  });
}

/**
 * Lista de quien recibe diseños. Key SWR compartida ('designers') → una sola
 * query por sesión aunque el hook se monte varias veces en la misma página
 * (toolbar, detail sheet, diálogo de crear). Antes era useEffect+fetch sin caché → N queries.
 */
export function useDesigners() {
  const { data, error, isLoading } = useSWR<Designer[]>('designers', fetchDesigners);

  return {
    designers: data ?? [],
    loading: isLoading,
    error: error ? 'Error al cargar diseñadores' : null,
  };
}
