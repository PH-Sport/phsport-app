'use client';

import { useState } from 'react';
import { DetailPanel, type DetailView } from '@/components/features/campograma/detail-panel';
import { Pitch } from '@/components/features/campograma/pitch';
import { CampogramaSkeleton } from '@/components/skeletons/campograma-skeleton';
import { DashboardPage } from '@/components/ui/dashboard-page';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useAuth } from '@/lib/auth/auth-context';
import { usePortfolio } from '@/lib/hooks/use-portfolio';

/** La cartera de Agentes: campo, lista y ficha. Por ahora, solo consulta (spec §4). */
export default function CampogramaPage() {
  const { status } = useAuth();
  const { players, categories, isLoading, error, retry } = usePortfolio();
  const [categoryId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailView | null>(null);

  const category = categories.find((c) => c.id === categoryId) ?? categories[0];
  const inCategory = players.filter((p) => p.categoryId === category?.id);

  return (
    <DashboardPage
      title="Campograma"
      loading={status === 'INITIALIZING' || isLoading}
      skeleton={<CampogramaSkeleton />}
    >
      {error ? (
        <ErrorState title="No se pudo cargar la cartera" onRetry={retry} />
      ) : players.length === 0 ? (
        <EmptyState title="La cartera está vacía" />
      ) : (
        <Pitch
          players={inCategory}
          query=""
          onOpenPosition={(position) => setDetail({ kind: 'position', position })}
        />
      )}
      <DetailPanel
        view={detail}
        onChange={setDetail}
        players={players}
        categories={categories}
        category={category}
        query=""
      />
    </DashboardPage>
  );
}
