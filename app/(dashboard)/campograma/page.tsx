'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { DetailPanel, type DetailView } from '@/components/features/campograma/detail-panel';
import { Pitch } from '@/components/features/campograma/pitch';
import { NoResults, Toolbar } from '@/components/features/campograma/toolbar';
import { CampogramaSkeleton } from '@/components/skeletons/campograma-skeleton';
import { DashboardPage } from '@/components/ui/dashboard-page';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useAuth } from '@/lib/auth/auth-context';
import { usePortfolio } from '@/lib/hooks/use-portfolio';
import { countByCategory, matchesSearch, signalPlayers } from '@/lib/utils/campograma';

/** La cartera de Agentes: campo, lista y ficha. Por ahora, solo consulta (spec §4). */
export default function CampogramaPage() {
  const { status } = useAuth();
  const { players, categories, isLoading, error, retry } = usePortfolio();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<DetailView | null>(null);

  const category = categories.find((c) => c.id === categoryId) ?? categories[0];
  const inCategory = useMemo(
    () => players.filter((p) => p.categoryId === category?.id),
    [players, category?.id]
  );
  const matching = useMemo(() => inCategory.filter((p) => matchesSearch(p, query)), [inCategory, query]);
  const counts = useMemo(() => countByCategory(players, query), [players, query]);

  const changeCategory = (id: string) => {
    setCategoryId(id);
    setDetail(null);
  };

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
        <>
          <Toolbar
            categories={categories}
            categoryId={category?.id}
            onCategoryChange={changeCategory}
            counts={counts}
            query={query}
            onQueryChange={setQuery}
            total={matching.length}
            bySignal={{
              loaned: signalPlayers(matching, 'loaned').length,
              pending: signalPlayers(matching, 'pending').length,
              noClub: signalPlayers(matching, 'noClub').length,
            }}
            onOpenSignal={(signal) => setDetail({ kind: 'signal', signal })}
          />
          {matching.length === 0 && (
            <NoResults
              category={category}
              categories={categories}
              counts={counts}
              onJump={changeCategory}
            />
          )}
          {/* El fundido solo al cambiar de categoría: la búsqueda repinta con cada
              tecla y sería un parpadeo. */}
          <motion.div
            key={category?.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Pitch
              players={inCategory}
              query={query}
              onOpenPosition={(position) => setDetail({ kind: 'position', position })}
            />
          </motion.div>
        </>
      )}
      <DetailPanel
        view={detail}
        onChange={setDetail}
        players={players}
        categories={categories}
        category={category}
        query={query}
      />
    </DashboardPage>
  );
}
