'use client';

/**
 * La ficha del jugador desde la agencia: mandarle el enlace, retocarla y
 * borrarla. Todo con la sesión de quien lo hace, bajo la RLS de `players`,
 * `invitations` y el cubo.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { generateInviteToken, inviteExpiry } from '@/lib/services/invitations/token';
import { BUCKET } from './files';

export interface PlayerInvite {
  id: string;
  token: string;
  expires_at: string;
}

/**
 * Un enlace nuevo para esta ficha: 24 h, un uso, sin rol (spec §8). Lleva
 * `player_id` y nada más; `created_by` lo pone la base. Los enlaces
 * anteriores no se borran: caducan solos y la base ya no los da por válidos
 * en cuanto la ficha tenga cuenta.
 */
export async function createPlayerInvitation(supabase: SupabaseClient, playerId: string): Promise<PlayerInvite> {
  const token = generateInviteToken();
  const { data, error } = await supabase
    .from('invitations')
    .insert({ token, player_id: playerId, max_uses: 1, expires_at: inviteExpiry().toISOString() })
    .select('id, token, expires_at')
    .single();
  if (error || !data) throw new Error(`No se pudo crear el enlace: ${error?.message ?? 'sin respuesta'}`);
  return data as PlayerInvite;
}

export interface PlayerPatch {
  given_name?: string;
  family_name?: string | null;
  active?: boolean;
}

export async function updatePlayer(supabase: SupabaseClient, id: string, patch: PlayerPatch): Promise<void> {
  const { error } = await supabase.from('players').update(patch).eq('id', id);
  if (error) throw new Error(`No se pudo guardar la ficha: ${error.message}`);
}

/**
 * Borrar la ficha borra sus filas en cascada (archivos e invitaciones), pero
 * el cubo no sabe de cascadas: primero se vacía su carpeta, después la fila.
 * Si la cuenta del jugador existe, se queda (desenganchada); borrar cuentas
 * es otra cosa y tiene su propia función.
 */
export async function deletePlayer(supabase: SupabaseClient, playerId: string): Promise<void> {
  const { data: objects, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(playerId, { limit: 1000 });
  if (listError) throw new Error(`No se pudo vaciar su carpeta: ${listError.message}`);
  const paths = (objects ?? []).map((o) => `${playerId}/${o.name}`);
  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
    if (removeError) throw new Error(`No se pudo vaciar su carpeta: ${removeError.message}`);
  }
  const { error } = await supabase.from('players').delete().eq('id', playerId);
  if (error) throw new Error(`No se pudo borrar la ficha: ${error.message}`);
}
