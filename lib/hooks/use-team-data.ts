import useSWR from 'swr';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { assignableProfiles } from '@/lib/services/profiles/assignable';
import { useAuth } from '@/lib/auth/auth-context';
import { viewModeFor } from '@/lib/utils/access';
import type { Design } from '@/lib/types/design';

export interface DesignerWithDesigns {
  id: string;
  full_name: string;
  display_name: string;
  avatar_url?: string | null;
  weekly_capacity: number;
  designs: Design[];
}

interface UseTeamDataReturn {
  designers: DesignerWithDesigns[];
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

const fetchTeamData = async ([, weekStart, weekEnd]: [string, Date, Date]): Promise<DesignerWithDesigns[]> => {
  const supabase = createClient();

  // 1. Quien recibe diseños en el reparto
  const { data: designersData, error: designersError } = await assignableProfiles<{
    id: string;
    full_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    weekly_capacity: number | null;
  }>(supabase, 'id, full_name, display_name, avatar_url, weekly_capacity');

  if (designersError) throw designersError;

  // 2. Get designs for the week
  const { data: designsData, error: designsError } = await supabase
    .from('designs')
    .select('*')
    .gte('deadline_at', format(weekStart, 'yyyy-MM-dd'))
    .lte('deadline_at', format(weekEnd, "yyyy-MM-dd'T'23:59:59"));

  if (designsError) throw designsError;

  // 3. Group designs by designer
  const designerMap = new Map<string, DesignerWithDesigns>();

  (designersData || []).forEach((d) => {
    designerMap.set(d.id, {
      id: d.id,
      full_name: d.full_name || 'Sin nombre',
      display_name: d.display_name || d.full_name || 'Sin nombre',
      avatar_url: d.avatar_url ?? undefined,
      weekly_capacity: d.weekly_capacity ?? 10,
      designs: [],
    });
  });

  (designsData || []).forEach((design) => {
    if (design.designer_id && designerMap.has(design.designer_id)) {
      designerMap.get(design.designer_id)!.designs.push(design);
    }
  });

  return Array.from(designerMap.values());
};

export function useTeamData(weekStart: Date, weekEnd: Date): UseTeamDataReturn {
  const { profile, status } = useAuth();
  const isManager = status === 'AUTHENTICATED' && viewModeFor(profile) === 'manager';

  const { data, error, isLoading, mutate } = useSWR<DesignerWithDesigns[]>(
    // Solo la cara de gestión pide la semana del equipo.
    isManager ? ['team-data', weekStart, weekEnd] : null,
    fetchTeamData
  );

  return {
    designers: data ?? [],
    isLoading,
    error: error ?? null,
    mutate,
  };
}
