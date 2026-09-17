import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { bulkCreateDesignsSchema } from '@/lib/api/schemas';
import {
  validationErrorResponse,
  internalErrorResponse,
  unauthorizedResponse,
} from '@/lib/api/errors';
import { assignableProfiles } from '@/lib/services/profiles/assignable';
import { selectDesignerByLoad } from '@/lib/services/designs/select-designer';
import { buildWeeklyWeightMaps, loadMapForWeek, weekKeyFor } from '@/lib/services/designs/weekly-load';
import { getDesignWeightValue } from '@/lib/types/design';

export async function POST(request: Request) {
  const reqId = crypto.randomUUID();
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = bulkCreateDesignsSchema.safeParse(rawBody);
    if (!parsed.success) return validationErrorResponse(parsed.error, reqId);
    const { designs } = parsed.data;

    // Validar que ningún deadline esté en el pasado (más de 1h atrás).
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (let i = 0; i < designs.length; i++) {
      if (new Date(designs[i].deadline_at).getTime() < oneHourAgo) {
        return NextResponse.json(
          { error: `Diseño ${i + 1}: la fecha límite no puede ser anterior a hace 1 hora` },
          { status: 400 }
        );
      }
    }

    const supabase = await createClient();

    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) return unauthorizedResponse();

    // Cualquier usuario autenticado (mánager o diseñador) puede crear diseños.
    logger.serverInfo('[API Bulk] Attempt', {
      reqId,
      userId: data.user.id,
      count: designs.length,
      firstTitle: designs[0]?.title || designs[0]?.player || null,
      firstDeadline: designs[0]?.deadline_at || null,
    });

    // Obtener diseñadores y carga actual para asignación equitativa en lote.
    const { data: designers, error: designersError } = await assignableProfiles(supabase);

    if (designersError) {
      logger.serverError('[API Bulk] Error fetching designers', { reqId, error: designersError });
      return internalErrorResponse(designersError, 'fetch designers', reqId);
    }

    const designerIds = (designers ?? []).map((d) => d.id);

    const { data: activeDesigns, error: designsError } = await supabase
      .from('designs')
      .select('id, designer_id, deadline_at, type')
      .neq('status', 'DELIVERED')
      .not('designer_id', 'is', null);

    if (designsError) {
      logger.serverError('[API Bulk] Error fetching active designs', { reqId, error: designsError });
      return internalErrorResponse(designsError, 'fetch active designs', reqId);
    }

    const weekMaps = buildWeeklyWeightMaps(activeDesigns ?? [], designerIds);
    const cursorByWeek = new Map<string, number>();

    // Si hay >1 diseño suprimimos notificaciones individuales y creamos una agregada.
    const shouldAggregate = designs.length > 1;

    const designsToInsert = designs.map((d) => {
      const wk = weekKeyFor(d.deadline_at);
      const loadMap = loadMapForWeek(weekMaps, wk, designerIds);

      let designerId: string | null = null;
      if (d.designer_id && d.designer_id !== 'auto') {
        designerId = d.designer_id;
      } else {
        const cursor = cursorByWeek.get(wk) ?? 0;
        const selection = selectDesignerByLoad(designerIds, loadMap, cursor);
        designerId = selection.id;
        cursorByWeek.set(wk, selection.nextIndex);
      }

      // El diseño recién repartido pesa en su semana para los siguientes del lote.
      if (designerId && loadMap.has(designerId)) {
        loadMap.set(designerId, (loadMap.get(designerId) ?? 0) + getDesignWeightValue(d.type));
      }

      const title = d.title?.trim() || d.player;
      const isMatchday = (d.type ?? 'matchday') === 'matchday';

      return {
        title,
        type: d.type ?? 'matchday',
        player: d.player,
        match_home: isMatchday ? d.match_home : null,
        match_away: isMatchday ? d.match_away : null,
        deadline_at: d.deadline_at,
        folder_url: d.folder_url || null,
        details: d.details || null,
        designer_id: designerId,
        created_by: data.user.id,
        status: 'BACKLOG' as const,
        suppress_assignment_notification: shouldAggregate,
      };
    });

    const { data: createdDesigns, error } = await supabase
      .from('designs')
      .insert(designsToInsert)
      .select();

    if (error) {
      logger.serverError('[API Bulk] Insert failed', {
        reqId,
        userId: data.user.id,
        attemptedCount: designsToInsert.length,
        attemptedTitles: designsToInsert.map((d) => d.title),
        attemptedDeadlines: designsToInsert.map((d) => d.deadline_at),
        error,
      });
      return internalErrorResponse(error, 'bulk insert', reqId);
    }

    const createdCount = createdDesigns?.length ?? 0;
    if (createdCount < designsToInsert.length) {
      logger.serverError('[API Bulk] Partial insert', {
        reqId,
        userId: data.user.id,
        attempted: designsToInsert.length,
        created: createdCount,
        missing: designsToInsert.length - createdCount,
      });
    }

    if (shouldAggregate && createdDesigns && createdDesigns.length > 0) {
      const designerMap = new Map<string, number>();
      createdDesigns.forEach((d) => {
        if (d.designer_id) {
          const currentCount = designerMap.get(d.designer_id) || 0;
          designerMap.set(d.designer_id, currentCount + 1);
        }
      });

      const notifications = [];
      for (const [designerId, count] of designerMap.entries()) {
        notifications.push({
          user_id: designerId,
          type: 'assignment',
          title: 'Nuevas asignaciones',
          message: `Se te han asignado ${count} nuevos diseños`,
          link: '/mi-semana',
          meta: { assignment_count: count },
          read: false,
        });
      }

      if (notifications.length > 0) {
        const { error: notifError } = await supabase.from('notifications').insert(notifications);
        if (notifError) {
          logger.serverError('[API Bulk] Error sending notifications', { reqId, error: notifError });
        }
      }
    }

    logger.serverInfo('[API Bulk] Success', {
      reqId,
      userId: data.user.id,
      created: createdCount,
      requested: designs.length,
    });

    return NextResponse.json(
      {
        created: createdCount,
        failed: designs.length - createdCount,
        designs: createdDesigns ?? [],
      },
      { status: 201 }
    );
  } catch (error) {
    return internalErrorResponse(error, 'bulk unhandled', reqId);
  }
}
