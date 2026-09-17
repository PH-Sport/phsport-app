import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateAssigneeSchema } from '@/lib/api/schemas';
import {
  validationErrorResponse,
  internalErrorResponse,
  unauthorizedResponse,
} from '@/lib/api/errors';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = crypto.randomUUID();
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const rawBody = await request.json().catch(() => ({}));
  const parsed = updateAssigneeSchema.safeParse(rawBody);
  if (!parsed.success) return validationErrorResponse(parsed.error, reqId);
  const { designer_id } = parsed.data;

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return unauthorizedResponse();

  // Cualquier usuario autenticado puede reasignar diseños.
  // Resolver 'auto' a id concreto.
  let resolvedDesignerId: string | null = designer_id ?? null;
  if (designer_id === 'auto') {
    const { assignDesignerAutomatically } = await import('@/lib/services/designs/assignment');
    resolvedDesignerId = await assignDesignerAutomatically(id);
  } else if (designer_id) {
    // El destino tiene que recibir asignaciones: se lo preguntamos a la base,
    // que es quien tiene la respuesta (misma función que usan las políticas).
    const { data: allowed, error: targetError } = await supabase.rpc('has_permission', {
      uid: designer_id,
      perm: 'recibir_asignaciones',
    });
    if (targetError || allowed !== true) {
      return NextResponse.json(
        { error: 'designer_id debe corresponder a alguien que reciba asignaciones' },
        { status: 400 }
      );
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('designs')
    .update({ designer_id: resolvedDesignerId })
    .eq('id', id)
    .select()
    .single();

  if (updateError) return internalErrorResponse(updateError, 'assignee update', reqId);
  return NextResponse.json(updated);
}
