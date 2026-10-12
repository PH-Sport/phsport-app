import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { loadAccess } from '@/lib/api/access';
import { DEPARTMENTS, departmentsManagedBy } from '@/lib/utils/access';
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
    // El rol de UN departamento. Antes era «que le queden exactamente estos
    // roles», y con dos departamentos eso borraba el del otro al cambiar uno.
    department_role: z
      .object({ department: z.enum(DEPARTMENTS), role_id: z.string().uuid() })
      .optional(),
  })
  .refine(
    (d) =>
      d.given_name !== undefined ||
      d.family_name !== undefined ||
      d.alias !== undefined ||
      d.department_role !== undefined,
    { message: 'Nada que actualizar' }
  );

/**
 * PATCH /api/users/[id] — renombrar a un miembro y/o cambiarle el rol de un
 * departamento.
 * - Renombrar exige `gestionar_roles`: es la ficha del compañero.
 * - El rol exige poder repartir en ESE departamento (`departmentsManagedBy`):
 *   un director cambia entre Agente y Director, nada de creativo.
 * La RLS de `profiles` y `profile_roles` exige lo mismo (migraciones 045 y
 * 050), así que no hace falta service-role. La guardia de la base impide
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
  const hasNameChange = body.given_name !== undefined || body.family_name !== undefined || body.alias !== undefined;
  if (hasNameChange && !access.can('gestionar_roles')) return forbiddenResponse();
  if (body.department_role && !departmentsManagedBy(access).includes(body.department_role.department)) {
    return forbiddenResponse();
  }

  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', id)
    .single();
  if (targetError || !target) return notFoundResponse('Usuario');

  if (body.department_role) {
    // No te cambias tu propio rol (evita autobloqueo; la guardia de la base cubre el resto).
    if (id === user.id) {
      return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 403 });
    }
    const { error: rolesError } = await supabase.rpc('set_department_role', {
      p_profile_id: id,
      p_department: body.department_role.department,
      p_role_id: body.department_role.role_id,
    });
    if (rolesError) return conflictFromDbError(rolesError) ?? internalErrorResponse(rolesError, 'set role', reqId);
  }

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
