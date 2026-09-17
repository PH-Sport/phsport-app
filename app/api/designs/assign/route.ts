import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadAccess } from '@/lib/api/access';
import { logger } from '@/lib/utils/logger';
import { assignableProfiles } from '@/lib/services/profiles/assignable';
import {
  internalErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/api/errors';
import { selectDesignerByLoad } from '@/lib/services/designs/select-designer';
import { buildWeeklyWeightMaps, loadMapForWeek, weekKeyFor } from '@/lib/services/designs/weekly-load';
import { getDesignWeightValue } from '@/lib/types/design';

/**
 * Asignación balanceada por carga ponderada semanal.
 * Distribuye diseños sin asignar entre diseñadores en una sola pasada
 * (1 fetch de cargas + reparto in-memory por semana según peso de tipo +
 * batch update por diseñador).
 */
export async function POST(_request: Request) {
  const reqId = crypto.randomUUID();
  const supabase = await createClient();

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) return unauthorizedResponse();

  // Reparte cualquiera del departamento creativo: no hay jerarquía dentro (spec §3).
  const access = await loadAccess(supabase, data.user.id);
  if (!access.inDepartment('creativo')) return forbiddenResponse();

  // 1. Diseños sin asignar.
  const { data: unassigned, error: unassignedError } = await supabase
    .from('designs')
    .select('id, deadline_at, type')
    .is('designer_id', null)
    .eq('status', 'BACKLOG');

  if (unassignedError) return internalErrorResponse(unassignedError, 'fetch unassigned', reqId);
  if (!unassigned || unassigned.length === 0) {
    return NextResponse.json({ message: 'No hay diseños sin asignar', assigned: 0 });
  }

  // 2. Quien recibe diseños en el reparto.
  const { data: designers, error: designersError } = await assignableProfiles(supabase);

  if (designersError) return internalErrorResponse(designersError, 'fetch designers', reqId);
  const designerIds = (designers ?? []).map((d) => d.id);
  if (designerIds.length === 0) {
    return NextResponse.json(
      { error: 'No hay diseñadores disponibles' },
      { status: 400 }
    );
  }

  // 3. Carga actual.
  const { data: activeDesigns, error: activeError } = await supabase
    .from('designs')
    .select('designer_id, deadline_at, type')
    .neq('status', 'DELIVERED')
    .not('designer_id', 'is', null);

  if (activeError) return internalErrorResponse(activeError, 'fetch active designs', reqId);

  const weekMaps = buildWeeklyWeightMaps(activeDesigns ?? [], designerIds);
  const cursorByWeek = new Map<string, number>();

  // 4. Reparto in-memory por semana: agrupar por diseñador asignado.
  const assignmentsByDesigner = new Map<string, string[]>();

  for (const design of unassigned) {
    const wk = weekKeyFor(design.deadline_at);
    const loadMap = loadMapForWeek(weekMaps, wk, designerIds);
    const cursor = cursorByWeek.get(wk) ?? 0;
    const { id: selectedId, nextIndex } = selectDesignerByLoad(designerIds, loadMap, cursor);
    if (!selectedId) continue;
    cursorByWeek.set(wk, nextIndex);

    loadMap.set(selectedId, (loadMap.get(selectedId) ?? 0) + getDesignWeightValue(design.type));

    if (!assignmentsByDesigner.has(selectedId)) {
      assignmentsByDesigner.set(selectedId, []);
    }
    assignmentsByDesigner.get(selectedId)!.push(design.id);
  }

  // 5. Update por diseñador (un round-trip por designer en lugar de uno por diseño).
  let assignedCount = 0;
  for (const [designerId, designIds] of assignmentsByDesigner.entries()) {
    const { error: updateError } = await supabase
      .from('designs')
      .update({ designer_id: designerId })
      .in('id', designIds);
    if (!updateError) {
      assignedCount += designIds.length;
    } else {
      logger.serverError('[API Assign] Update failed', { reqId, designerId, count: designIds.length, error: updateError });
    }
  }

  if (assignedCount === 0) {
    return NextResponse.json(
      { error: 'No se pudo asignar ningún diseño' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: `Se asignaron ${assignedCount} diseño(s)`,
    assigned: assignedCount,
  });
}
