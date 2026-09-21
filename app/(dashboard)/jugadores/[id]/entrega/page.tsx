'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Image as ImageIcon, Loader2, Plus, Upload, Video, X } from 'lucide-react';
import { toast } from 'sonner';
import { SPRINGS, STAGGER, TWEENS } from '@/components/ui/animations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DashboardPage } from '@/components/ui/dashboard-page';
import { RowSeparator } from '@/components/ui/row';
import { PlayerDetailSkeleton } from '@/components/skeletons/player-detail-skeleton';
import { Section } from '@/components/ui/section';
import { useAuth } from '@/lib/auth/auth-context';
import { useRequireDepartment } from '@/lib/hooks/use-require-department';
import { usePlayer } from '@/lib/hooks/use-player';
import { createClient } from '@/lib/supabase/client';
import { uploadPlayerFile } from '@/lib/services/players/files';
import {
  checkUploadable,
  fileKind,
  FOLDERS,
  folderLabel,
  formatBytes,
  type Folder,
} from '@/lib/utils/players';
import { logger } from '@/lib/utils/logger';
import { cn } from '@/lib/utils';

interface Pending {
  key: string;
  file: File;
  /** Motivo del último fallo, si lo hubo, para reintentar sin volver a elegir. */
  error?: string;
}

const rise = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: SPRINGS.gentle },
};

/**
 * Una entrega (spec §5 y §6): carpeta de destino, un rótulo, y los archivos
 * tal cual, sin recomprimir. Se suben uno a uno con la sesión de quien
 * entrega; lo que falle se queda en la lista con su motivo.
 */
export default function NewDeliveryPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const { allowed, authLoading, denied } = useRequireDepartment('creativo');
  const { player, isLoading } = usePlayer(allowed ? id : null);

  const [folder, setFolder] = useState<Folder>('fotos');
  const [batch, setBatch] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (denied) return null;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next: Pending[] = [];
    for (const file of Array.from(list)) {
      const reason = checkUploadable(file);
      if (reason) {
        toast.error(reason);
        continue;
      }
      next.push({ key: `${file.name}-${file.size}-${file.lastModified}`, file });
    }
    setPending((prev) => {
      const seen = new Set(prev.map((p) => p.key));
      return [...prev, ...next.filter((p) => !seen.has(p.key))];
    });
    if (inputRef.current) inputRef.current.value = '';
  };

  const deliver = async () => {
    if (!user || !player || pending.length === 0) return;
    setProgress({ done: 0, total: pending.length });
    const supabase = createClient();
    const failed: Pending[] = [];
    let done = 0;
    for (const item of pending) {
      try {
        await uploadPlayerFile(supabase, {
          playerId: player.id,
          file: item.file,
          folder,
          batch: batch || null,
          uploadedBy: user.id,
        });
      } catch (e) {
        logger.error('Error uploading file:', e);
        failed.push({ ...item, error: e instanceof Error ? e.message : 'No se pudo subir' });
      }
      done += 1;
      setProgress({ done, total: pending.length });
    }
    setProgress(null);
    mutate(['player-files', player.id]);
    mutate('players');

    if (failed.length === 0) {
      toast.success(
        `${pending.length === 1 ? 'Archivo entregado' : `${pending.length} archivos entregados`} a ${player.given_name}`
      );
      router.push(`/jugadores/${player.id}/${folder}`);
      return;
    }
    setPending(failed);
    toast.error(
      `${failed.length} de ${pending.length} no se pudieron subir. Quedan en la lista para reintentar.`
    );
  };

  const uploading = progress !== null;
  const showSkeleton = authLoading || (isLoading && !player);

  return (
    <DashboardPage
      title="Nueva entrega"
      skeleton={<PlayerDetailSkeleton />}
      loading={showSkeleton}
      maxWidth="2xl"
    >
      <motion.div
        variants={{ show: { transition: { staggerChildren: STAGGER } } }}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        <motion.div variants={rise} className="-mt-2">
          <Button variant="ghost" size="sm" asChild className="-ml-3">
            <Link href={`/jugadores/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {player?.full_name ?? 'Jugador'}
            </Link>
          </Button>
        </motion.div>

        {player && (
          <>
            <motion.div variants={rise}>
              <Section
                label="Destino"
                hint="En qué carpeta y con qué nombre lo verá"
                padded={false}
              >
                <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
                  <span className="text-[15px]">Carpeta</span>
                  <Select
                    value={folder}
                    onValueChange={(v) => setFolder(v as Folder)}
                    disabled={uploading}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FOLDERS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {folderLabel(f)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <RowSeparator />
                <div className="flex min-h-14 items-center gap-3 px-4 py-2">
                  <label htmlFor="batch" className="shrink-0 text-[15px]">
                    Nombre
                  </label>
                  <Input
                    id="batch"
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
                    placeholder="Jornada 12"
                    disabled={uploading}
                    className="h-10 rounded-xl"
                  />
                </div>
              </Section>
            </motion.div>

            <motion.div variants={rise}>
              <Section label="Archivos" hint="Se entregan tal cual, sin recomprimir">
                <div className="space-y-3">
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    className="sr-only"
                    onChange={(e) => addFiles(e.target.files)}
                    disabled={uploading}
                  />
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    className={cn(
                      'flex h-14 w-full items-center justify-center gap-2.5 rounded-xl border border-dashed border-primary/35 text-[15px] font-semibold',
                      'outline-none transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60'
                    )}
                  >
                    <Plus className="h-[18px] w-[18px] text-primary" aria-hidden />
                    Añadir archivos
                  </button>

                  {/* Las filas entran y salen con fundido, y las demás se recolocan
                  con muelle en vez de saltar al hueco (layout). */}
                  <AnimatePresence initial={false}>
                    {pending.length > 0 && (
                      <motion.ul
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={TWEENS.base}
                        className="overflow-hidden rounded-xl bg-background"
                      >
                        <AnimatePresence initial={false}>
                          {pending.map((item, i) => {
                            const Icon =
                              fileKind(item.file.type, item.file.name) === 'video'
                                ? Video
                                : ImageIcon;
                            return (
                              <motion.li
                                key={item.key}
                                layout
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{
                                  opacity: TWEENS.base,
                                  y: SPRINGS.gentle,
                                  layout: SPRINGS.smooth,
                                }}
                              >
                                {i > 0 && <RowSeparator inset={70} />}
                                <div className="flex items-center gap-3.5 px-4 py-3">
                                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[15px] font-medium">
                                      {item.file.name}
                                    </span>
                                    <span
                                      className={cn(
                                        'text-xs tabular',
                                        item.error ? 'text-destructive' : 'text-muted-foreground'
                                      )}
                                    >
                                      {item.error ?? formatBytes(item.file.size)}
                                    </span>
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={`Quitar ${item.file.name}`}
                                    disabled={uploading}
                                    onClick={() =>
                                      setPending((prev) => prev.filter((p) => p.key !== item.key))
                                    }
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    <X className="h-[17px] w-[17px]" aria-hidden />
                                  </button>
                                </div>
                              </motion.li>
                            );
                          })}
                        </AnimatePresence>
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              </Section>
            </motion.div>

            <motion.div variants={rise}>
              <Button
                onClick={deliver}
                disabled={uploading || pending.length === 0}
                size="lg"
                className="h-11 w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Subiendo {progress.done} de {progress.total}…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Entregar a {player.given_name}
                  </>
                )}
              </Button>
            </motion.div>
          </>
        )}
      </motion.div>
    </DashboardPage>
  );
}
