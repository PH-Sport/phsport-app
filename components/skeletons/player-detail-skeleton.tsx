import { PageContainer } from '@/components/ui/page-container';
import { Skeleton } from '@/components/ui/skeleton';
import { Surface } from '@/components/ui/surface';

/** Skeleton de /jugadores/[id]: volver, nombre, y las placas de cuenta y carpetas. */
export function PlayerDetailSkeleton() {
  return (
    <PageContainer maxWidth="2xl">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-9 w-48" />
      {[2, 3].map((rows, i) => (
        <div key={i}>
          <Skeleton className="mb-1 h-3 w-20" />
          <Skeleton className="mb-3 h-3 w-48" />
          <Surface variant="grouped" padded={false} className="overflow-hidden">
            {[...Array(rows)].map((_, j) => (
              <div key={j} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </Surface>
        </div>
      ))}
      <Skeleton className="h-11 w-full rounded-xl" />
    </PageContainer>
  );
}
