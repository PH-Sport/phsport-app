import { PageContainer } from '@/components/ui/page-container';
import { Skeleton } from '@/components/ui/skeleton';
import { Surface } from '@/components/ui/surface';

const NAME_WIDTHS = ['w-32', 'w-40', 'w-28', 'w-36'];

/** Skeleton de /jugadores: título y una lista de filas (avatar, nombre, segunda línea). */
export function PlayersSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-9 w-40" />
      <Surface variant="plain" padded={false} className="overflow-hidden">
        {NAME_WIDTHS.map((w, i) => (
          <div key={i} className="flex min-h-16 items-center gap-3 px-4 py-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className={`h-4 ${w}`} />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </Surface>
      <Skeleton className="h-14 w-full rounded-2xl" />
    </PageContainer>
  );
}
