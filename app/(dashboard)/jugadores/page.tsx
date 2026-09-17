'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronRight, Plus, Users } from 'lucide-react';
import { DashboardPage } from '@/components/ui/dashboard-page';
import { Surface } from '@/components/ui/surface';
import { RowSeparator } from '@/components/ui/row';
import { UserAvatar } from '@/components/ui/user-avatar';
import { SPRINGS, STAGGER } from '@/components/ui/animations';
import { PlayersSkeleton } from '@/components/skeletons/players-skeleton';
import { NewPlayerDialog } from '@/components/features/players/new-player-dialog';
import { useAuth } from '@/lib/auth/auth-context';
import { homeFor, viewModeFor } from '@/lib/utils/access';
import { usePlayers, type PlayerSummary } from '@/lib/hooks/use-players';
import { playerSubtitle } from '@/lib/utils/players';
import { cn } from '@/lib/utils';

const rise = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: SPRINGS.gentle },
};

/**
 * La cartera: una fila por ficha, tenga cuenta o no (spec §8). El nombre y,
 * debajo, qué hay: cuenta y conteos, o el enlace que caduca, o nada todavía.
 */
export default function PlayersPage() {
  const router = useRouter();
  const { profile, access, status } = useAuth();
  const authLoading = status === 'INITIALIZING';
  const allowed = access.inDepartment('creativo');
  const { players, isLoading, mutate } = usePlayers();
  const [newOpen, setNewOpen] = useState(false);
  const [now] = useState(() => new Date());

  // Solo el departamento creativo gestiona jugadores; el resto, a su casa.
  useEffect(() => {
    if (!authLoading && profile && !allowed) router.replace(homeFor(viewModeFor(profile)));
  }, [authLoading, profile, allowed, router]);

  if (!authLoading && profile && !allowed) return null;

  const showSkeleton = authLoading || (isLoading && players.length === 0);

  return (
    <DashboardPage title="Jugadores" icon={Users} skeleton={<PlayersSkeleton />} loading={showSkeleton} maxWidth="2xl">
      <motion.div
        variants={{ show: { transition: { staggerChildren: STAGGER } } }}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        {players.length === 0 ? (
          <motion.p variants={rise} className="px-2 py-6 text-center text-sm text-muted-foreground">
            Todavía no hay ninguna ficha. Crea la primera y, cuando toque, mándale el enlace desde ella.
          </motion.p>
        ) : (
          <motion.div variants={rise}>
            <Surface variant="plain" padded={false} className="overflow-hidden">
              <ul>
                {players.map((p, i) => (
                  <li key={p.id}>
                    {/* 16 de padding + 40 de avatar + 12 de hueco = 68 */}
                    {i > 0 && <RowSeparator inset={68} />}
                    <PlayerRow player={p} now={now} />
                  </li>
                ))}
              </ul>
            </Surface>
          </motion.div>
        )}

        <motion.button
          variants={rise}
          type="button"
          onClick={() => setNewOpen(true)}
          className={cn(
            'flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm font-medium text-muted-foreground',
            'outline-none transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          <Plus className="h-5 w-5" aria-hidden />
          Nuevo jugador
        </motion.button>
      </motion.div>

      <NewPlayerDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(id) => {
          mutate();
          router.push(`/jugadores/${id}`);
        }}
      />
    </DashboardPage>
  );
}

function PlayerRow({ player, now }: { player: PlayerSummary; now: Date }) {
  const subtitle = playerSubtitle(
    { hasAccount: player.profile_id !== null, counts: player.counts, inviteExpiresAt: player.invite?.expires_at ?? null },
    now
  );
  return (
    <Link
      href={`/jugadores/${player.id}`}
      className={cn(
        'flex min-h-16 items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        !player.active && 'opacity-60'
      )}
    >
      <UserAvatar
        name={player.full_name}
        className="h-10 w-10 shrink-0"
        fallbackClassName="bg-primary/10 font-mono text-xs font-semibold text-primary"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-medium leading-5">
          {player.full_name}
          {!player.active && <span className="ml-2 text-xs font-normal text-muted-foreground">Inactivo</span>}
        </span>
        <span className="truncate font-mono tabular text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
