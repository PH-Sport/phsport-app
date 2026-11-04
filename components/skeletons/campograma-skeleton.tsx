import { PageContainer } from '@/components/ui/page-container';
import { Skeleton } from '@/components/ui/skeleton';

/** Skeleton de /campograma: el título y el campo, de pie o tumbado como el de verdad. */
export function CampogramaSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mx-auto aspect-[3/4] w-full max-w-[620px] rounded-surface lg:aspect-[3/2] lg:w-[min(100%,calc((100dvh-250px)*1.5))] lg:max-w-none" />
    </PageContainer>
  );
}
