import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Perfiles con el permiso `recibir_asignaciones`, bajo la RLS del llamante.
 * Sustituye a los `.eq('role', 'DESIGNER')` que había repartidos por seis
 * sitios: si mañana cambia qué significa «entrar en el reparto», cambia aquí.
 *
 * `columns` es un string cualquiera, así que supabase-js no puede inferir la
 * fila: se fija con `T` (por defecto, solo `id`).
 */
export function assignableProfiles<T = { id: string }>(supabase: SupabaseClient, columns: string = 'id') {
  return supabase
    .rpc('profiles_with_permission', { perm: 'recibir_asignaciones' })
    .select(columns)
    .overrideTypes<T[], { merge: false }>();
}
