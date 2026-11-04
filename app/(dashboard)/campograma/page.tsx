'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Coaches } from '@/components/features/campograma/coaches';
import { DetailPanel, type DetailView } from '@/components/features/campograma/detail-panel';
import { Legend } from '@/components/features/campograma/legend';
import { Pitch } from '@/components/features/campograma/pitch';
import { PlayerList, type PlayerSort } from '@/components/features/campograma/player-list';
import { NoResults, Toolbar } from '@/components/features/campograma/toolbar';
import { CampogramaSkeleton } from '@/components/skeletons/campograma-skeleton';
import { DashboardPage } from '@/components/ui/dashboard-page';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Tabs, TabsList, TabsTriggerSliding } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth/auth-context';
import { usePortfolio } from '@/lib/hooks/use-portfolio';
import { countByCategory, matchesSearch, signalPlayers } from '@/lib/utils/campograma';

type View = 'field' | 'list';

/** La cartera de Agentes: campo, lista y ficha. Por ahora, solo consulta (spec §4). */
export default function CampogramaPage() {
  const { status } = useAuth();
  const { players, categories, isLoading, error, retry } = usePortfolio();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('field');
  const [sort, setSort] = useState<PlayerSort>({ key: 'name', dir: 1 });
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
            viewSwitch={
              <Tabs value={view} onValueChange={(v) => setView(v as View)}>
                <TabsList>
                  <TabsTriggerSliding value="field" active={view === 'field'} indicatorId="campograma-vista">
                    Campo
                  </TabsTriggerSliding>
                  <TabsTriggerSliding value="list" active={view === 'list'} indicatorId="campograma-vista">
                    Lista
                  </TabsTriggerSliding>
                </TabsList>
              </Tabs>
            }
          />
          {matching.length === 0 && (
            <NoResults
              category={category}
              categories={categories}
              counts={counts}
              onJump={changeCategory}
            />
          )}
          {/* El fundido solo al cambiar de categoría o de vista: la búsqueda repinta
              con cada tecla y sería un parpadeo. */}
          <motion.div
            key={`${category?.id}|${view}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {view === 'field' ? (
              <Pitch
                players={inCategory}
                query={query}
                onOpenPosition={(position) => setDetail({ kind: 'position', position })}
              />
            ) : (
              matching.length > 0 && (
                <PlayerList
                  players={matching}
                  sort={sort}
                  onSort={setSort}
                  onOpenPlayer={(playerId) => setDetail({ kind: 'player', playerId, back: null })}
                />
              )
            )}
          </motion.div>
          <Legend />
          <Coaches
            categories={categories}
            onOpenCoach={(id) => setDetail({ kind: 'coach', categoryId: id })}
          />
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
