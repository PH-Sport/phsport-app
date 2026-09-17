import { createClient } from '@/lib/supabase/server';
import { assignableProfiles } from '@/lib/services/profiles/assignable';
import { logger } from '@/lib/utils/logger';
import { selectDesignerByLoad } from './select-designer';
import { buildWeeklyWeightMaps, loadMapForWeek, weekKeyFor } from './weekly-load';

/**
 * Asigna automáticamente un diseñador a UN diseño según la carga ponderada de
 * la semana a la que pertenece ese diseño (mismo criterio que las rutas de
 * lote). El propio diseño se excluye del conteo.
 *
 * @param designId — id del diseño que se está (re)asignando. Se excluye del conteo.
 * @param deadlineAt — fecha de entrega efectiva (ISO). Si se omite, se lee la
 *   almacenada del diseño. Pásala cuando el mismo request cambia la fecha, para
 *   repartir según la semana NUEVA y no la antigua.
 */
export async function assignDesignerAutomatically(
  designId: string,
  deadlineAt?: string,
): Promise<string | null> {
  try {
    const supabase = await createClient();

    const { data: designers, error: designersError } = await assignableProfiles(supabase);

    if (designersError) {
      logger.error('Error fetching designers for assignment:', designersError);
      return null;
    }
    if (!designers || designers.length === 0) {
      logger.warn('No designers found for assignment');
      return null;
    }
    const designerIds = designers.map((d) => d.id);

    // Semana objetivo: la fecha efectiva pasada, o la almacenada del diseño.
    let effectiveDeadline = deadlineAt;
    if (!effectiveDeadline) {
      const { data: target, error: targetError } = await supabase
        .from('designs')
        .select('deadline_at')
        .eq('id', designId)
        .single();
      if (targetError || !target) {
        logger.error('Error fetching target design for assignment:', targetError);
        return null;
      }
      effectiveDeadline = target.deadline_at;
    }
    const wk = weekKeyFor(effectiveDeadline);

    const { data: activeDesigns, error: designsError } = await supabase
      .from('designs')
      .select('id, designer_id, deadline_at, type')
      .neq('status', 'DELIVERED')
      .not('designer_id', 'is', null);

    if (designsError) {
      logger.error('Error fetching active designs for assignment:', designsError);
      return null;
    }

    // Carga ponderada de la semana objetivo, excluyendo el propio diseño.
    const weekMaps = buildWeeklyWeightMaps(
      (activeDesigns ?? []).filter((d) => d.id !== designId),
      designerIds,
    );
    const loadMap = loadMapForWeek(weekMaps, wk, designerIds);

    return selectDesignerByLoad(designerIds, loadMap).id;
  } catch (error) {
    logger.error('Unexpected error in assignDesignerAutomatically:', error);
    return null;
  }
}
