'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload } from 'lucide-react';
import { SPRINGS, STAGGER } from '@/components/ui/animations';
import { Button } from '@/components/ui/button';
import { DashboardPage } from '@/components/ui/dashboard-page';
import { HelpHint } from '@/components/ui/help-hint';
import { PlayerDetailSkeleton } from '@/components/skeletons/player-detail-skeleton';
import { FileGrid } from '@/components/features/players/file-grid';
import { FileList } from '@/components/features/players/file-list';
import { FileSheet } from '@/components/features/players/file-sheet';
import { useRequireDepartment } from '@/lib/hooks/use-require-department';
import { usePlayer, usePlayerFiles } from '@/lib/hooks/use-player';
import { filesIn, folderLabel, isFolderView, SENT, type PlayerFile } from '@/lib/utils/players';

const rise = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: SPRINGS.gentle },
};

/**
 * Una carpeta del jugador vista desde la agencia. Fotos y Matchdays van en
 * rejilla por lotes; «Enviados por él» va en lista, porque ahí lo que se hace
 * es decidir dónde va cada cosa. Tocar un archivo abre su hoja: descargar,
 * mover, eliminar.
 */
export default function PlayerFolderPage() {
  const { id, folder } = useParams<{ id: string; folder: string }>();
  const { mutate: mutateGlobal } = useSWRConfig();
  const { allowed, authLoading, denied } = useRequireDepartment('creativo');
  const view = isFolderView(folder) ? folder : null;
  const { player, isLoading } = usePlayer(allowed ? id : null);
  const { files, isLoading: filesLoading, mutate } = usePlayerFiles(allowed ? id : null);
  const [selected, setSelected] = useState<PlayerFile | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (denied) return null;

  const shown = view ? filesIn(files, view) : [];
  const title = view === SENT ? 'Enviados por él' : view ? folderLabel(view) : 'Carpeta';
  const showSkeleton = authLoading || (isLoading && !player) || (filesLoading && files.length === 0);

  const changed = () => {
    mutate();
    mutateGlobal('players');
  };

  return (
    <DashboardPage
      title={title}
      subtitle={
        player
          ? `${player.full_name} · ${shown.length} ${shown.length === 1 ? 'archivo' : 'archivos'}`
          : undefined
      }
      skeleton={<PlayerDetailSkeleton />}
      loading={showSkeleton}
      maxWidth="2xl"
    >
      <motion.div
        variants={{ show: { transition: { staggerChildren: STAGGER } } }}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        <motion.div variants={rise} className="-mt-2 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" asChild className="-ml-3">
            <Link href={`/jugadores/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {player?.full_name ?? 'Jugador'}
            </Link>
          </Button>
          {view && view !== SENT && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/jugadores/${id}/entrega`}>
                <Upload className="mr-2 h-4 w-4" />
                Nueva entrega
              </Link>
            </Button>
          )}
          {/* El «?» solo en Enviados: es donde mover algo cambia quién puede
              quitarlo, y eso la pantalla no lo dice sola. */}
          {view === SENT && <HelpHint tipId="enviados-son-de-la-agencia" align="end" />}
        </motion.div>

        <motion.div variants={rise}>
          {!view ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Esta carpeta no existe.
            </p>
          ) : view === SENT ? (
            <FileList
              files={shown}
              onSelect={(f) => {
                setSelected(f);
                setSheetOpen(true);
              }}
              emptyText="No ha enviado nada todavía. Lo que mande aparecerá aquí hasta que lo coloques en una carpeta."
            />
          ) : (
            <FileGrid
              files={shown}
              onSelect={(f) => {
                setSelected(f);
                setSheetOpen(true);
              }}
              emptyText="Carpeta vacía. Lo que le entregues aquí lo verá en su área personal."
            />
          )}
        </motion.div>
      </motion.div>

      <FileSheet
        file={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        canManage
        canRemove={false}
        onChanged={changed}
      />
    </DashboardPage>
  );
}
