/**
 * Jugadores, carpetas y archivos — la lógica pura (spec §5, §8 y §9).
 *
 * Las carpetas son fijas y las mismas para todos, así que no tienen tabla:
 * viven aquí, como los tipos de diseño. Un archivo sin carpeta
 * (`folder === null`) es un envío del jugador que la agencia todavía no ha
 * colocado; eso es «Enviados», que es una vista, no un valor de carpeta.
 */

import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const FOLDERS = ['fotos', 'matchdays'] as const;
export type Folder = (typeof FOLDERS)[number];

/** La vista de lo que él mandó y nadie colocó. NO se guarda en `folder`. */
export const SENT = 'enviados' as const;
export type FolderView = Folder | typeof SENT;

const LABELS: Record<FolderView, string> = {
  fotos: 'Fotos',
  matchdays: 'Matchdays',
  enviados: 'Enviados',
};

export function folderLabel(view: FolderView): string {
  return LABELS[view];
}

export function isFolder(x: string | null | undefined): x is Folder {
  return typeof x === 'string' && (FOLDERS as readonly string[]).includes(x);
}

export function isFolderView(x: string | null | undefined): x is FolderView {
  return x === SENT || isFolder(x);
}

/** Fila de `player_files` tal como la devuelve la base. */
export interface PlayerFile {
  id: string;
  player_id: string;
  folder: string | null;
  batch: string | null;
  name: string;
  storage_path: string;
  thumb_path: string | null;
  mime_type: string | null;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
}

// ─── Archivos: qué son y si se pueden subir ───────────────────

export type FileKind = 'image' | 'video' | 'other';

export function fileKind(mime: string | null | undefined, name?: string): FileKind {
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('video/')) return 'video';
  const ext = extensionOf(name ?? '');
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'webm'].includes(ext)) return 'video';
  return 'other';
}

/** Techo del plan gratuito de Supabase Storage, y el del cubo (migración 046). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Los mismos tipos que admite el cubo. Cambiar uno es cambiar los dos. */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;

/** Motivo por el que un archivo no se puede subir, o null si puede. */
export function checkUploadable(file: { name: string; size: number; type: string }): string | null {
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name} pesa ${formatBytes(file.size)}; el máximo son ${formatBytes(MAX_FILE_BYTES)}.`;
  }
  if (file.size === 0) return `${file.name} está vacío.`;
  // Algunos navegadores no ponen tipo (HEIC en Safari, por ejemplo): se mira
  // la extensión antes de rechazarlo.
  const type = file.type || mimeFromExtension(file.name);
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(type)) {
    return `${file.name} no es una imagen ni un vídeo.`;
  }
  return null;
}

export function mimeFromExtension(name: string): string {
  switch (extensionOf(name)) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    default:
      return '';
  }
}

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

/**
 * Dónde va cada archivo dentro del cubo `jugadores` (spec §9):
 * `{player_id}/{file_id}.{ext}` y su miniatura `{player_id}/{file_id}.thumb.jpg`.
 * El primer tramo es el jugador: las reglas del cubo lo leen de ahí.
 */
export function storagePaths(playerId: string, fileId: string, fileName: string) {
  const ext = extensionOf(fileName).replace(/[^a-z0-9]/g, '') || 'bin';
  return {
    path: `${playerId}/${fileId}.${ext}`,
    thumbPath: `${playerId}/${fileId}.thumb.jpg`,
  };
}

/** «6,2 MB», con coma, que es como se lee aquí. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;
  return `${(mb / 1024).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`;
}

// ─── Carpetas: conteos, portadas y lotes ──────────────────────

export function filesIn(files: PlayerFile[], view: FolderView): PlayerFile[] {
  return files.filter((f) => (view === SENT ? f.folder === null : f.folder === view));
}

export function folderCounts(files: PlayerFile[]): Record<FolderView, number> {
  const counts: Record<FolderView, number> = { fotos: 0, matchdays: 0, enviados: 0 };
  for (const f of files) {
    if (f.folder === null) counts.enviados += 1;
    else if (isFolder(f.folder)) counts[f.folder] += 1;
  }
  return counts;
}

/** La miniatura de la última imagen de la carpeta, para la portada. */
export function folderCover(files: PlayerFile[], folder: Folder): string | null {
  const latest = filesIn(files, folder)
    .filter((f) => f.thumb_path && fileKind(f.mime_type, f.name) === 'image')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return latest?.thumb_path ?? null;
}

export interface FileBatch {
  key: string;
  /** Rótulo de la entrega, o el día si no lo tiene. */
  label: string;
  /** «12 oct». */
  date: string;
  files: PlayerFile[];
}

/**
 * Agrupa por rótulo de entrega (spec §6: separadas por fecha, sin subcarpetas).
 * Los lotes van del más reciente al más antiguo; dentro, en orden de subida.
 * Un archivo sin rótulo se agrupa con los de su mismo día.
 */
export function groupFilesByBatch(files: PlayerFile[]): FileBatch[] {
  const byKey = new Map<string, FileBatch & { latest: string }>();
  for (const f of files) {
    const day = f.created_at.slice(0, 10);
    const key = f.batch ? `b:${f.batch}` : `d:${day}`;
    let batch = byKey.get(key);
    if (!batch) {
      batch = {
        key,
        label: f.batch ?? formatDay(f.created_at),
        date: formatDay(f.created_at),
        files: [],
        latest: f.created_at,
      };
      byKey.set(key, batch);
    }
    batch.files.push(f);
    if (f.created_at > batch.latest) batch.latest = f.created_at;
  }
  return [...byKey.values()]
    .sort((a, b) => b.latest.localeCompare(a.latest))
    .map(({ latest: _latest, ...batch }) => ({
      ...batch,
      files: [...batch.files].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }));
}

export function formatDay(iso: string): string {
  return format(new Date(iso), 'd MMM', { locale: es });
}

// ─── La ficha en la lista ─────────────────────────────────────

/** «21 h», «35 min», o null si ya caducó. */
export function expiresInLabel(expiresAt: string | Date, now: Date): string | null {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return null;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)} min`;
  return `${Math.floor(minutes / 60)} h`;
}

/**
 * La segunda línea de cada jugador en la lista:
 * «Con cuenta · Fotos 48 · Matchdays 6», «Sin cuenta · enlace caduca en 21 h»
 * o «Sin cuenta».
 */
export function playerSubtitle(
  input: { hasAccount: boolean; counts: Record<Folder, number>; inviteExpiresAt: string | null },
  now: Date
): string {
  if (input.hasAccount) {
    const parts = FOLDERS.map((f) => `${folderLabel(f)} ${input.counts[f]}`);
    return ['Con cuenta', ...parts].join(' · ');
  }
  const left = input.inviteExpiresAt ? expiresInLabel(input.inviteExpiresAt, now) : null;
  return left ? `Sin cuenta · enlace caduca en ${left}` : 'Sin cuenta';
}

/** Iniciales para el avatar de una ficha sin foto. */
export function playerInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
