'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import type { PortfolioName } from '@/lib/utils/player-suggestions';

async function fetchPortfolioNames(): Promise<PortfolioName[]> {
  // Creativo no lee la cartera: la función es la única puerta y solo da nombre
  // y equipo de los activos. A quien no es de creativo le devuelve vacío.
  const { data, error } = await createClient().rpc('portfolio_names');
  if (error) throw error;
  return (data ?? []) as PortfolioName[];
}

/**
 * Nombres de la cartera para sugerir al crear diseños. Una sola consulta por
 * sesión aunque haya varias tarjetas abiertas. Si falla, el campo sigue siendo
 * texto libre y no se avisa: crear el diseño no depende de esto.
 */
export function usePortfolioNames(): PortfolioName[] {
  const { data } = useSWR<PortfolioName[]>('portfolio-names', fetchPortfolioNames, {
    revalidateOnFocus: false,
  });
  return data ?? [];
}
