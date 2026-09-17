'use client';

import useSWR from 'swr';
import type { PostgrestError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { DEPARTMENTS, PERMISSIONS, type Department, type Permission } from '@/lib/utils/access';

export interface RoleWithPermissions {
  id: string;
  name: string;
  department: Department;
  permissions: Permission[];
}

interface RawRoleRow {
  id: string;
  name: string;
  department: string;
  role_permissions: { permission: string }[] | null;
}

async function fetchRoles(): Promise<RoleWithPermissions[]> {
  const supabase = createClient();
  // Sin tipos generados, `from()` devuelve `any`: la fila se fija a mano aquí.
  const { data, error }: { data: RawRoleRow[] | null; error: PostgrestError | null } = await supabase
    .from('roles')
    .select('id, name, department, role_permissions(permission)')
    .order('created_at', { ascending: true });
  if (error) throw error;

  return (data ?? [])
    .filter((r) => (DEPARTMENTS as readonly string[]).includes(r.department))
    .map((r) => ({
      id: r.id,
      name: r.name,
      department: r.department as Department,
      permissions: (r.role_permissions ?? [])
        .map((p) => p.permission)
        .filter((p): p is Permission => (PERMISSIONS as readonly string[]).includes(p)),
    }));
}

/** Roles de la agencia (fijos; los siembra una migración). Solo con sesión: la RLS exige ser personal. */
export function useRoles() {
  const { status } = useAuth();
  const { data, error, isLoading, mutate } = useSWR<RoleWithPermissions[]>(
    status === 'AUTHENTICATED' ? 'roles' : null,
    fetchRoles
  );
  return { roles: data ?? [], isLoading, error: error ?? null, mutate };
}
