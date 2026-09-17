'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { format, endOfWeek, addDays, addWeeks } from 'date-fns';
import { useAuth } from '@/lib/auth/auth-context';
import { viewModeFor } from '@/lib/utils/access';
import { designsFetcher } from '@/lib/utils/api-fetcher';
import { summarizeUpcoming, HORIZON_WEEKS, type UpcomingWork } from '@/lib/utils/upcoming-work';
import type { Design } from '@/lib/types/design';

const VACIO: UpcomingWork = { count: 0, firstDeadline: null };

/**
 * Trabajo pendiente que queda al otro lado de la semana visible.
 *
 * Vive aparte de `useDashboard` a propósito: aquel alimenta los KPIs de la
 * semana en curso y no conviene ensanchar su rango (cambiaría sus cuentas y su
 * caché). Este pide su propio tramo — del lunes siguiente al techo del
 * horizonte — y solo sirve para la coletilla del rótulo.
 *
 * Acota por rol igual que hace la pantalla que lo usa: un diseñador cuenta los
 * suyos, un admin los del equipo.
 */
export function useUpcomingWork(): UpcomingWork {
  const { user, profile, status } = useAuth();

  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const from = addDays(weekEnd, 1);
  const to = addWeeks(weekEnd, HORIZON_WEEKS);

  const isDesigner = viewModeFor(profile) === 'designer';
  // Un diseñador sin id todavía resuelto pediría el backlog entero del equipo y
  // contaría de más: mejor esperar a tenerlo.
  const ready = status === 'AUTHENTICATED' && profile !== null && (!isDesigner || Boolean(user?.id));

  const url = ready
    ? `/api/designs?${new URLSearchParams({
        weekStart: format(from, 'yyyy-MM-dd'),
        weekEnd: format(to, 'yyyy-MM-dd'),
        ...(isDesigner && user?.id ? { designerId: user.id } : {}),
      }).toString()}`
    : null;

  const { data } = useSWR<Design[]>(url, designsFetcher);

  return useMemo(() => (data ? summarizeUpcoming(data) : VACIO), [data]);
}
