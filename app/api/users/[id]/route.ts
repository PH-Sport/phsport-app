import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { loadAccess } from '@/lib/api/access';
import {
  validationErrorResponse,
  internalErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictFromDbError,
} from '@/lib/api/errors';

const updateUserSchema = z
  .object({
    given_name: z.string().trim().min(1, 'El nombre no puede estar vacío').max(80).optional(),
    family_name: z.string().trim().max(80).nullable().optional(),
    alias: z.string().trim().max(80).nullable().optional(),
    role_ids: z.array(z.string().uuid()).min(1, 'Elige un rol').optional(),
  })
  .refine(
    (d) =>
      d.given_name !== undefined ||
      d.family_name !== undefined ||
      d.alias !== undefined ||
      d.role_ids !== undefined,
    { message: 'Nada que actualizar' }
  );

/**
 * PATCH /api/users/[id] — renombrar a un miembro y/o dejarle exactamente estos roles.
 * Requiere `gestionar_roles`: quien gestiona los roles gestiona también la
 * ficha del compañero. La RLS de `profiles` y de `profile_roles` exige lo
 * mismo, así que no hace falta service-role. La guardia de la base impide
 * quedarse sin nadie que gestione roles; aquí solo se traduce su error.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const reqId = crypto.randomUUID();
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const rawBody = await request.json().catch(() => ({}));
  const parsed = updateUserSchema.safeParse(rawBody);
  if (!parsed.success) return validationErrorResponse(parsed.error, reqId);
  const body = parsed.data;

  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return unauthorizedResponse();

  const access = await loadAccess(supabase, user.id);
  if (!access.can('gestionar_roles')) return forbiddenResponse();

  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', id)
    .single();
  if (targetError || !target) return notFoundResponse('Usuario');

  if (body.role_ids !== undefined) {
    // No te cambias tu propio rol (evita autobloqueo; la guardia de la base cubre el resto).
    if (id === user.id) {
      return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 403 });
    }
    const { error: rolesError } = await supabase.rpc('set_profile_roles', {
      p_profile_id: id,
      p_role_ids: body.role_ids,
    });
    if (rolesError) return conflictFromDbError(rolesError) ?? internalErrorResponse(rolesError, 'set roles', reqId);
  }

  const hasNameChange = body.given_name !== undefined || body.family_name !== undefined || body.alias !== undefined;
  if (!hasNameChange) return NextResponse.json({ ok: true });

  const updateData: Record<string, unknown> = {};
  if (body.given_name !== undefined) updateData.given_name = body.given_name;
  if (body.family_name !== undefined) updateData.family_name = body.family_name || null;
  if (body.alias !== undefined) updateData.alias = body.alias || null;
  updateData.updated_at = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', id)
    .select('id, given_name, family_name, alias, full_name, display_name')
    .single();

  if (error) return internalErrorResponse(error, 'user update', reqId);
  return NextResponse.json(updated);
}
