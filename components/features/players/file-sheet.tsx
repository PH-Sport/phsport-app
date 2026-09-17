'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, FolderInput, Loader2, Trash2, X } from 'lucide-react';
import { TWEENS } from '@/components/ui/animations';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Collapse } from '@/components/ui/collapse';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { createClient } from '@/lib/supabase/client';
import { deletePlayerFile, movePlayerFile, signedUrl } from '@/lib/services/players/files';
import {
  fileKind,
  FOLDERS,
  folderLabel,
  formatBytes,
  formatDay,
  isFolder,
  type Folder,
  type PlayerFile,
} from '@/lib/utils/players';
import { logger } from '@/lib/utils/logger';

interface FileSheetProps {
  file: PlayerFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** La agencia: mover y borrar. */
  canManage: boolean;
  /** El jugador: quitar lo suyo mientras nadie lo haya colocado. */
  canRemove: boolean;
  /** Tras mover, borrar o quitar: que quien lo abrió recargue. */
  onChanged: () => void;
}

/**
 * Un archivo de cerca: vista previa, descarga y —según quién mire— mover,
 * borrar o quitar. Es la misma hoja para la agencia y para el jugador; lo que
 * cambia son los botones, y la RLS dice lo mismo desde la base.
 */
export function FileSheet({
  file,
  open,
  onOpenChange,
  canManage,
  canRemove,
  onChanged,
}: FileSheetProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<'download' | 'move' | 'delete' | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [targetFolder, setTargetFolder] = useState<Folder>('fotos');
  const [batch, setBatch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const kind = file ? fileKind(file.mime_type, file.name) : 'other';

  // La vista previa se firma al abrir; al cerrar se olvida. Una imagen grande
  // tarda: mientras llega se ve la miniatura, y si no hay, el nombre.
  useEffect(() => {
    if (!open || !file) {
      setPreviewUrl(null);
      setMoveOpen(false);
      setBatch('');
      return;
    }
    let cancelled = false;
    const path = kind === 'image' && file.thumb_path ? file.thumb_path : file.storage_path;
    signedUrl(createClient(), path)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(null);
      });
    if (isFolder(file.folder)) setTargetFolder(file.folder === 'fotos' ? 'matchdays' : 'fotos');
    return () => {
      cancelled = true;
    };
  }, [open, file, kind]);

  const download = async () => {
    if (!file) return;
    setBusy('download');
    // Una pestaña nueva: en iOS es lo que deja guardar el original en Fotos o
    // en Archivos; un <a download> ahí se ignora. Y se abre ANTES del await:
    // Safari bloquea como popup cualquier ventana que no nazca del toque.
    const tab = window.open('', '_blank');
    try {
      const url = await signedUrl(createClient(), file.storage_path, true);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (e) {
      tab?.close();
      toast.error(e instanceof Error ? e.message : 'No se pudo descargar');
    } finally {
      setBusy(null);
    }
  };

  const move = async () => {
    if (!file) return;
    setBusy('move');
    try {
      await movePlayerFile(createClient(), file.id, targetFolder, batch || file.batch);
      toast.success(`Movido a ${folderLabel(targetFolder)}`);
      onChanged();
      onOpenChange(false);
    } catch (e) {
      logger.error('Error moving file:', e);
      toast.error(e instanceof Error ? e.message : 'No se pudo mover');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!file) return;
    setBusy('delete');
    try {
      await deletePlayerFile(createClient(), file);
      toast.success(canManage ? 'Archivo borrado' : 'Archivo quitado');
      setConfirmDelete(false);
      onChanged();
      onOpenChange(false);
    } catch (e) {
      logger.error('Error deleting file:', e);
      toast.error(e instanceof Error ? e.message : 'No se pudo borrar');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[92svh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          {file && (
            <div className="mx-auto w-full max-w-lg">
              <SheetHeader className="text-left">
                <SheetTitle className="truncate pr-8">{file.name}</SheetTitle>
                <SheetDescription className="font-mono tabular text-xs">
                  {formatDay(file.created_at)} · {formatBytes(file.size_bytes)}
                  {file.folder
                    ? ` · ${isFolder(file.folder) ? folderLabel(file.folder) : file.folder}`
                    : ' · Enviado'}
                  {file.batch ? ` · ${file.batch}` : ''}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 overflow-hidden rounded-xl bg-muted">
                {previewUrl && kind === 'image' ? (
                  // Firmada y caducable: <img> a propósito, igual que en la rejilla.
                  // Se funde al llegar en vez de sustituir la rueda de golpe.
                  <motion.img
                    key={previewUrl}
                    src={previewUrl}
                    alt={file.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={TWEENS.base}
                    className="max-h-[50svh] w-full object-contain"
                  />
                ) : previewUrl && kind === 'video' ? (
                  <video src={previewUrl} controls playsInline className="max-h-[50svh] w-full" />
                ) : (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    {previewUrl === null ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      'Sin vista previa'
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <Button onClick={download} disabled={busy !== null} className="h-11 w-full">
                  {busy === 'download' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Descargar el original
                </Button>

                {canManage && (
                  <Button
                    variant="outline"
                    onClick={() => setMoveOpen((v) => !v)}
                    disabled={busy !== null}
                    aria-expanded={moveOpen}
                    className="h-11 w-full"
                  >
                    <FolderInput className="mr-2 h-4 w-4" />
                    Mover a una carpeta
                  </Button>
                )}

                {/* El panel de mover se despliega con la extensión suave de la
                    app, en vez de aparecer y desaparecer de golpe. */}
                <Collapse open={canManage && moveOpen}>
                  <div className="space-y-3 rounded-xl border border-border/60 p-3">
                    <div className="space-y-1.5">
                      <Label>Carpeta</Label>
                      <Select
                        value={targetFolder}
                        onValueChange={(v) => setTargetFolder(v as Folder)}
                      >
                        <SelectTrigger>
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
                    <div className="space-y-1.5">
                      <Label htmlFor="move-batch">Nombre de la entrega</Label>
                      <Input
                        id="move-batch"
                        value={batch}
                        onChange={(e) => setBatch(e.target.value)}
                        placeholder={file.batch ?? 'Jornada 12'}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMoveOpen(false)}
                        disabled={busy !== null}
                      >
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={move} disabled={busy !== null}>
                        {busy === 'move' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Mover
                      </Button>
                    </div>
                  </div>
                </Collapse>

                {(canManage || canRemove) && (
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy !== null}
                    className="h-11 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    {canManage ? (
                      <Trash2 className="mr-2 h-4 w-4" />
                    ) : (
                      <X className="mr-2 h-4 w-4" />
                    )}
                    {canManage ? 'Eliminar' : 'Quitar'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={remove}
        loading={busy === 'delete'}
        variant="danger"
        title={canManage ? '¿Eliminar este archivo?' : '¿Quitar este archivo?'}
        description={
          canManage
            ? 'Desaparece del área personal del jugador y del cubo. No hay papelera.'
            : 'Lo quitas de lo que has enviado. La agencia ya no lo verá.'
        }
        confirmLabel={canManage ? 'Eliminar' : 'Quitar'}
      />
    </>
  );
}
