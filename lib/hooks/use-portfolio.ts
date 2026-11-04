'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import {
  isActiveRow,
  toPortfolioPlayer,
  type PortfolioCategory,
  type PortfolioPlayer,
  type PortfolioPlayerRow,
} from '@/lib/utils/campograma';

const PLAYER_COLUMNS =
  'id, name, birth_year, owner_club, situation, loaned_to, position, category_id, photo_url, deactivated_at';

interface Portfolio {
  players: PortfolioPlayer[];
  categories: PortfolioCategory[];
}

async function fetchPortfolio(): Promise<Portfolio> {
  const supabase = createClient();
  const [players, categories] = await Promise.all([
    supabase.from('portfolio_players').select(PLAYER_COLUMNS).is('deactivated_at', null).order('name'),
    supabase.from('portfolio_categories').select('id, name, short_name, coach').order('sort_order'),
  ]);
  if (players.error) throw players.error;
  if (categories.error) throw categories.error;
  return {
    // La consulta ya deja fuera a los de baja; esto es lo que garantiza que nunca
    // lleguen a la pantalla aunque alguien la cambie al traer la lista de bajas.
    players: ((players.data ?? []) as PortfolioPlayerRow[]).filter(isActiveRow).map(toPortfolioPlayer),
    categories: (categories.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      shortName: c.short_name,
      coach: c.coach,
    })),
  };
}

/** La cartera del campograma. La base solo se la da a quien es de Agentes (RLS, 051 y 053). */
export function usePortfolio() {
  const { data, error, isLoading, mutate } = useSWR<Portfolio>('portfolio', fetchPortfolio);
  return {
    players: data?.players ?? [],
    categories: data?.categories ?? [],
    isLoading,
    error,
    retry: () => void mutate(),
  };
}
