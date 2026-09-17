'use client';

/**
 * Área personal del futbolista (spec §5 y §6): un «mini Drive» donde él no
 * organiza. Ve las carpetas que le pone la agencia, con portada, descarga lo
 * que hay dentro, y sube lo que quiera mandar; eso cae en «Enviados» y lo
 * puede quitar mientras nadie lo haya colocado. Lo que la agencia mueve a una
 * carpeta deja de ser suyo para quitar.
 *
 * Disposición elegida (la «B» de las cuatro que se compararon): cada carpeta
 * enseña una portada, y la zona de subida ocupa todo lo que sobra hasta el
 * fondo — el hueco muerto pasa a ser la diana donde se sueltan los archivos.
 */

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Loader2, LogOut, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { SPRINGS } from '@/components/ui/animations';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileGrid } from '@/components/features/players/file-grid';
import { FileList } from '@/components/features/players/file-list';
import { FileSheet } from '@/components/features/players/file-sheet';
import { useAuth } from '@/lib/auth/auth-context';
import { useOwnPlayer } from '@/lib/hooks/use-own-player';
import { usePlayerFiles } from '@/lib/hooks/use-player';
import { useThumbUrls } from '@/lib/hooks/use-thumb-urls';
import { createClient } from '@/lib/supabase/client';
import { uploadPlayerFile } from '@/lib/services/players/files';
import {
  checkUploadable,
  filesIn,
  folderCounts,
  folderCover,
  folderLabel,
  FOLDERS,
  SENT,
  type Folder,
  type FolderView,
  type PlayerFile,
} from '@/lib/utils/players';
import { logger } from '@/lib/utils/logger';
import { cn } from '@/lib/utils';

type Vista = 'inicio' | FolderView;

/** Portadas mientras una carpeta no tiene fotos: césped y noche de partido. */
const COVER_FALLBACK: Record<Folder, string> = {
  fotos: 'linear-gradient(155deg, hsl(140 32% 34%), hsl(146 36% 19%))',
  matchdays: 'linear-gradient(155deg, hsl(212 38% 36%), hsl(220 36% 18%))',
};

export function AreaPersonal() {
  const { user, profile, logout } = useAuth();
  const { player, isLoading: playerLoading } = useOwnPlayer();
  const { files, mutate } = usePlayerFiles(player?.id ?? null);
  const [vista, setVista] = useState<Vista>('inicio');
  const [selected, setSelected] = useState<PlayerFile | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = (file: PlayerFile) => {
    setSelected(file);
    setSheetOpen(true);
  };

  const upload = async (list: FileList | null) => {
    if (!list || !user || !player) return;
    const accepted: File[] = [];
    for (const file of Array.from(list)) {
      const reason = checkUploadable(file);
      if (reason) toast.error(reason);
      else accepted.push(file);
    }
    if (inputRef.current) inputRef.current.value = '';
    if (accepted.length === 0) return;

    setProgress({ done: 0, total: accepted.length });
    const supabase = createClient();
    let failed = 0;
    let done = 0;
    for (const file of accepted) {
      try {
        await uploadPlayerFile(supabase, { playerId: player.id, file, folder: null, batch: null, uploadedBy: user.id });
      } catch (e) {
        logger.error('Error uploading file:', e);
        failed += 1;
      }
      done += 1;
      setProgress({ done, total: accepted.length });
    }
    setProgress(null);
    mutate();
    if (failed === 0) toast.success(accepted.length === 1 ? 'Enviado' : `${accepted.length} archivos enviados`);
    else toast.error(`${failed} de ${accepted.length} no se pudieron enviar. Prueba otra vez.`);
  };

  if (playerLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Cargando" />
      </div>
    );
  }

  return (
    // svh y no vh: en iOS la barra del navegador se come el 100vh y la última
    // fila queda debajo del borde. Las safe-area son para la PWA instalada.
    <div className="mx-auto flex h-svh w-full max-w-lg flex-col pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="sr-only"
        onChange={(e) => upload(e.target.files)}
        disabled={progress !== null}
      />

      <motion.div
        key={vista}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRINGS.gentle}
        className="flex min-h-0 flex-1 flex-col"
      >
        {!player ? (
          <SinFicha displayName={profile?.display_name} onLogout={logout} />
        ) : vista === 'inicio' ? (
          <Inicio
            files={files}
            displayName={profile?.display_name}
            progress={progress}
            onAbrir={(f) => setVista(f)}
            onEnviados={() => setVista(SENT)}
            onSubir={() => inputRef.current?.click()}
            onLogout={logout}
          />
        ) : vista === SENT ? (
          <Enviados
            files={filesIn(files, SENT)}
            progress={progress}
            onVolver={() => setVista('inicio')}
            onSubir={() => inputRef.current?.click()}
            onSelect={open}
          />
        ) : (
          <Carpeta folder={vista} files={filesIn(files, vista)} onVolver={() => setVista('inicio')} onSelect={open} />
        )}
      </motion.div>

      <FileSheet
        file={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        canManage={false}
        canRemove={!!selected && selected.folder === null && selected.uploaded_by === user?.id}
        onChanged={() => mutate()}
      />
    </div>
  );
}

// ─── Avatar con salida ───────────────────────────────────────

function Avatar({ displayName, onLogout }: { displayName?: string | null; onLogout: () => Promise<void> }) {
  const iniciales = (displayName ?? '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    // Sin cabecera ni menú de usuario en este marco, el avatar es la única
    // puerta para salir. Sin nombre debajo: él ya sabe quién es.
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Tu cuenta"
          className="flex h-11 w-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            {iniciales}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void onLogout()} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Sin ficha ───────────────────────────────────────────────

function SinFicha({ displayName, onLogout }: { displayName?: string | null; onLogout: () => Promise<void> }) {
  return (
    <>
      <div className="flex justify-end px-[18px] pt-2.5">
        <Avatar displayName={displayName} onLogout={onLogout} />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Área personal</h1>
        <p className="text-sm text-muted-foreground">
          Tu cuenta todavía no está enganchada a ninguna ficha. Dile a la agencia que te mande un enlace nuevo.
        </p>
      </div>
    </>
  );
}

// ─── Inicio ──────────────────────────────────────────────────

function Inicio({
  files,
  displayName,
  progress,
  onAbrir,
  onEnviados,
  onSubir,
  onLogout,
}: {
  files: PlayerFile[];
  displayName?: string | null;
  progress: { done: number; total: number } | null;
  onAbrir: (folder: Folder) => void;
  onEnviados: () => void;
  onSubir: () => void;
  onLogout: () => Promise<void>;
}) {
  const counts = folderCounts(files);
  const thumbs = useThumbUrls(files);

  return (
    <>
      <div className="flex justify-end px-[18px] pt-2.5">
        <Avatar displayName={displayName} onLogout={onLogout} />
      </div>

      <h1 className="mb-5 mt-1 px-[18px] text-3xl font-bold tracking-tight">Área personal</h1>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] pb-[18px]">
        {FOLDERS.map((folder) => {
          const coverPath = folderCover(files, folder);
          const cover = coverPath ? thumbs[coverPath] : undefined;
          return (
            <button
              key={folder}
              type="button"
              onClick={() => onAbrir(folder)}
              style={cover ? undefined : { background: COVER_FALLBACK[folder] }}
              className="relative block h-[150px] shrink-0 overflow-hidden rounded-surface bg-muted shadow-raised outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {cover && (
                // Firmada y caducable: <img> a propósito (ver file-grid.tsx).
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
              <span className="absolute inset-x-4 bottom-3.5 z-10 text-left text-white">
                <span className="block text-lg font-semibold tracking-tight">{folderLabel(folder)}</span>
                <span className="font-mono tabular text-xs opacity-85">
                  {counts[folder]} {counts[folder] === 1 ? 'archivo' : 'archivos'}
                </span>
              </span>
            </button>
          );
        })}

        {/* Crece hasta el fondo: lo que sobraba pasa a ser la diana. Con muchas
            carpetas se queda en su mínimo y el conjunto hace scroll. */}
        <div className="flex min-h-[190px] flex-1 flex-col overflow-hidden rounded-surface border border-dashed border-primary/35 bg-card">
          <button
            type="button"
            onClick={onSubir}
            disabled={progress !== null}
            className="flex flex-1 flex-col items-center justify-center gap-3 p-[18px] outline-none transition-colors active:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-70"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              {progress ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> : <Upload className="h-6 w-6" aria-hidden />}
            </span>
            <span className="text-[17px] font-semibold">
              {progress ? `Subiendo ${progress.done} de ${progress.total}…` : 'Subir archivos'}
            </span>
          </button>
          <button
            type="button"
            onClick={onEnviados}
            className="flex shrink-0 items-center justify-center gap-1.5 border-t border-dashed border-primary/35 p-4 text-[15px] text-muted-foreground outline-none transition-colors active:bg-muted active:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            {counts.enviados} {counts.enviados === 1 ? 'enviado' : 'enviados'}
            <ChevronRight className="h-[15px] w-[15px]" aria-hidden />
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Dentro de una carpeta ───────────────────────────────────

function Carpeta({
  folder,
  files,
  onVolver,
  onSelect,
}: {
  folder: Folder;
  files: PlayerFile[];
  onVolver: () => void;
  onSelect: (file: PlayerFile) => void;
}) {
  return (
    <>
      <Volver etiqueta={folderLabel(folder)} onVolver={onVolver} />
      <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-6">
        {/* Las entregas se separan por fecha, pero NO son subcarpetas: es un
            rótulo. No hay un nivel más en el que entrar. Tocar una foto abre
            su hoja, y desde ahí se descarga el original. */}
        <FileGrid files={files} onSelect={onSelect} emptyText="Aquí no hay nada todavía." />
      </div>
    </>
  );
}

// ─── Lo que él ha mandado ────────────────────────────────────

function Enviados({
  files,
  progress,
  onVolver,
  onSubir,
  onSelect,
}: {
  files: PlayerFile[];
  progress: { done: number; total: number } | null;
  onVolver: () => void;
  onSubir: () => void;
  onSelect: (file: PlayerFile) => void;
}) {
  return (
    <>
      <Volver etiqueta="Enviados" onVolver={onVolver} />
      <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-6">
        <button
          type="button"
          onClick={onSubir}
          disabled={progress !== null}
          className={cn(
            'mb-5 flex w-full items-center justify-center gap-2.5 rounded-[15px] border border-dashed border-primary/35 bg-card p-4 text-[17px] font-semibold',
            'outline-none transition-colors active:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-70'
          )}
        >
          {progress ? <Loader2 className="h-[19px] w-[19px] animate-spin text-primary" aria-hidden /> : <Upload className="h-[19px] w-[19px] text-primary" aria-hidden />}
          {progress ? `Subiendo ${progress.done} de ${progress.total}…` : 'Subir archivos'}
        </button>
        {/* Puede quitar lo que él mandó; lo que le disteis vosotros, no. */}
        <FileList files={files} onSelect={onSelect} emptyText="No has enviado nada todavía." />
      </div>
    </>
  );
}

// ─── Compartido ──────────────────────────────────────────────

function Volver({ etiqueta, onVolver }: { etiqueta: string; onVolver: () => void }) {
  return (
    <button
      type="button"
      onClick={onVolver}
      className="flex items-center gap-2 self-start rounded-xl px-[18px] pb-4 pt-3.5 text-xl font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronLeft className="h-5 w-5 text-primary" aria-hidden />
      {etiqueta}
    </button>
  );
}
