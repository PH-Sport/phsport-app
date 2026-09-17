'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { signedThumbUrls } from '@/lib/services/players/files';
import type { PlayerFile } from '@/lib/utils/players';

/**
 * URLs firmadas de las miniaturas de una lista de archivos, en una sola
 * petición. El cubo es privado: sin firma no se ve nada. Duran diez minutos y
 * SWR las reparte entre todas las rejillas que pidan los mismos archivos.
 */
export function useThumbUrls(files: PlayerFile[]): Record<string, string> {
  const paths = files.map((f) => f.thumb_path).filter((p): p is string => !!p);
  const key = paths.length ? ['thumb-urls', paths.join('|')] : null;
  const { data } = useSWR(key, () => signedThumbUrls(createClient(), paths), {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });
  return data ?? {};
}
