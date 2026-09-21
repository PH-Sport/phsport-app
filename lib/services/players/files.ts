'use client';

/**
 * Subir, mover, borrar y descargar archivos de un jugador (spec §5 y §9).
 *
 * Todo va directo del navegador a Supabase con la sesión de quien lo hace:
 * la RLS del cubo `jugadores` y de `player_files` es la protección, no una
 * ruta de API. El orden de los pasos importa y está comentado donde importa.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  checkUploadable,
  fileKind,
  mimeFromExtension,
  storagePaths,
  type Folder,
  type PlayerFile,
} from '@/lib/utils/players';

export const BUCKET = 'jugadores';

/** Lado mayor de la miniatura. Suficiente para una rejilla de tres columnas en un móvil 3x. */
const THUMB_MAX = 480;

/**
 * Miniatura JPEG hecha en el navegador. El plan gratuito no transforma
 * imágenes en el servidor, y cargar veinte originales de 6 MB en una rejilla
 * mataría el móvil. Si el navegador no sabe decodificar el archivo (HEIC en
 * Chrome, por ejemplo), devuelve null y el archivo va sin miniatura.
 */
export async function makeThumbnail(file: Blob): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, THUMB_MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  } catch {
    return null;
  }
}

export interface UploadInput {
  playerId: string;
  file: File;
  /** Nula = envío del jugador («Enviados»). La agencia siempre pone carpeta. */
  folder: Folder | null;
  /** Rótulo de la entrega («Jornada 12»); solo tiene sentido con carpeta. */
  batch: string | null;
  uploadedBy: string;
}

/**
 * Crea la fila y después sube el archivo (y su miniatura si es imagen). En
 * ese orden y no al revés: la regla del cubo solo deja al jugador borrar un
 * objeto cuya fila exista, así que si la subida falla se pueden retirar los
 * objetos y luego la fila, y nunca queda un archivo huérfano en el cubo.
 * Lanza un Error con mensaje en castellano; quien llama lo enseña tal cual.
 */
export async function uploadPlayerFile(supabase: SupabaseClient, input: UploadInput): Promise<PlayerFile> {
  const { file, playerId } = input;
  const reason = checkUploadable(file);
  if (reason) throw new Error(reason);

  const id = crypto.randomUUID();
  const { path, thumbPath } = storagePaths(playerId, id, file.name);
  const contentType = file.type || mimeFromExtension(file.name);

  // La miniatura se hace antes de tocar nada: así la fila ya nace sabiendo si
  // la tiene (el jugador no puede editar filas, y no hace falta).
  const thumb = fileKind(contentType, file.name) === 'image' ? await makeThumbnail(file) : null;

  const row = {
    id,
    player_id: playerId,
    folder: input.folder,
    batch: input.batch?.trim() || null,
    name: file.name,
    storage_path: path,
    thumb_path: thumb ? thumbPath : null,
    mime_type: contentType || null,
    size_bytes: file.size,
    uploaded_by: input.uploadedBy,
  };
  const { data, error } = await supabase.from('player_files').insert(row).select('*').single();
  if (error || !data) throw new Error(`No se pudo registrar ${file.name}: ${error?.message ?? 'sin respuesta'}`);

  const undo = async () => {
    await supabase.storage.from(BUCKET).remove([path, ...(thumb ? [thumbPath] : [])]);
    await supabase.from('player_files').delete().eq('id', id);
  };

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType, cacheControl: '3600', upsert: false });
  if (uploadError) {
    await undo();
    throw new Error(`No se pudo subir ${file.name}: ${uploadError.message}`);
  }

  if (thumb) {
    const { error: thumbError } = await supabase.storage
      .from(BUCKET)
      .upload(thumbPath, thumb, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
    // La fila dice que hay miniatura: si no se pudo subir, mejor deshacer todo
    // y que reintente, antes que una rejilla con un hueco roto para siempre.
    if (thumbError) {
      await undo();
      throw new Error(`No se pudo subir la miniatura de ${file.name}: ${thumbError.message}`);
    }
  }

  return data as PlayerFile;
}

/**
 * Primero los objetos del cubo, después la fila. Al revés no funciona para el
 * jugador: la regla del cubo comprueba que la fila siga existiendo y sin
 * colocar. Para la agencia da igual, pero el orden es el mismo por simpleza.
 */
export async function deletePlayerFile(supabase: SupabaseClient, file: PlayerFile): Promise<void> {
  const paths = [file.storage_path, ...(file.thumb_path ? [file.thumb_path] : [])];
  const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
  if (removeError) throw new Error(`No se pudo borrar ${file.name}: ${removeError.message}`);
  const { error } = await supabase.from('player_files').delete().eq('id', file.id);
  if (error) throw new Error(`No se pudo borrar ${file.name}: ${error.message}`);
}

/** Mover es cambiar la carpeta, no copiar (spec §5). Solo la agencia puede. */
export async function movePlayerFile(
  supabase: SupabaseClient,
  fileId: string,
  folder: Folder,
  batch: string | null
): Promise<void> {
  const { error } = await supabase
    .from('player_files')
    .update({ folder, batch: batch?.trim() || null })
    .eq('id', fileId);
  if (error) throw new Error(`No se pudo mover el archivo: ${error.message}`);
}

/**
 * URL firmada: el cubo es privado y no hay URL pública. Un minuto para
 * descargar; la vista previa de un vídeo pide el archivo por trozos mientras
 * se reproduce o se busca, así que esa lleva diez minutos (`seconds`).
 */
export async function signedUrl(
  supabase: SupabaseClient,
  path: string,
  download = false,
  seconds = 60
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, seconds, download ? { download: true } : undefined);
  if (error || !data) throw new Error(`No se pudo preparar la descarga: ${error?.message ?? 'sin respuesta'}`);
  return data.signedUrl;
}

/** URLs firmadas de varias miniaturas de golpe (una petición), para las rejillas. */
export async function signedThumbUrls(
  supabase: SupabaseClient,
  paths: string[]
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 10);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) out[item.path] = item.signedUrl;
  }
  return out;
}
