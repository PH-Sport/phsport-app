import { describe, expect, it } from 'vitest';
import {
  checkUploadable,
  expiresInLabel,
  fileKind,
  filesIn,
  folderCounts,
  folderCover,
  folderLabel,
  formatBytes,
  groupFilesByBatch,
  isFolder,
  isFolderView,
  latestInvite,
  MAX_FILE_BYTES,
  playerInitials,
  playerSubtitle,
  storagePaths,
  type PlayerFile,
} from './players';

function file(over: Partial<PlayerFile> & { id: string }): PlayerFile {
  return {
    player_id: 'p1',
    folder: null,
    batch: null,
    name: `${over.id}.jpg`,
    storage_path: `p1/${over.id}.jpg`,
    thumb_path: `p1/${over.id}.thumb.jpg`,
    mime_type: 'image/jpeg',
    size_bytes: 1000,
    uploaded_by: 'u1',
    created_at: '2026-10-12T10:00:00.000Z',
    ...over,
  };
}

describe('carpetas', () => {
  it('conoce las dos carpetas y la vista de enviados', () => {
    expect(isFolder('fotos')).toBe(true);
    expect(isFolder('enviados')).toBe(false);
    expect(isFolderView('enviados')).toBe(true);
    expect(isFolder('otra')).toBe(false);
    expect(folderLabel('matchdays')).toBe('Matchdays');
  });

  it('cuenta por carpeta y deja lo sin colocar en enviados', () => {
    const files = [
      file({ id: 'a', folder: 'fotos' }),
      file({ id: 'b', folder: 'fotos' }),
      file({ id: 'c', folder: 'matchdays' }),
      file({ id: 'd', folder: null }),
      file({ id: 'e', folder: 'desconocida' }),
    ];
    expect(folderCounts(files)).toEqual({ fotos: 2, matchdays: 1, enviados: 1 });
    expect(filesIn(files, 'enviados').map((f) => f.id)).toEqual(['d']);
    expect(filesIn(files, 'fotos').map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('la portada es la miniatura de la última imagen, nunca un vídeo', () => {
    const files = [
      file({ id: 'old', folder: 'fotos', created_at: '2026-10-01T00:00:00Z' }),
      file({ id: 'new', folder: 'fotos', created_at: '2026-10-05T00:00:00Z' }),
      file({
        id: 'vid',
        folder: 'fotos',
        created_at: '2026-10-09T00:00:00Z',
        mime_type: 'video/mp4',
        thumb_path: null,
      }),
    ];
    expect(folderCover(files, 'fotos')).toBe('p1/new.thumb.jpg');
    expect(folderCover(files, 'matchdays')).toBeNull();
  });
});

describe('lotes', () => {
  it('agrupa por rótulo, del más reciente al más antiguo, y dentro por orden de subida', () => {
    const files = [
      file({
        id: 'j11-b',
        folder: 'fotos',
        batch: 'Jornada 11',
        created_at: '2026-09-28T10:05:00Z',
      }),
      file({
        id: 'j12-a',
        folder: 'fotos',
        batch: 'Jornada 12',
        created_at: '2026-10-12T10:00:00Z',
      }),
      file({
        id: 'j11-a',
        folder: 'fotos',
        batch: 'Jornada 11',
        created_at: '2026-09-28T10:00:00Z',
      }),
      file({
        id: 'j12-b',
        folder: 'fotos',
        batch: 'Jornada 12',
        created_at: '2026-10-12T10:01:00Z',
      }),
    ];
    const batches = groupFilesByBatch(files);
    expect(batches.map((b) => b.label)).toEqual(['Jornada 12', 'Jornada 11']);
    expect(batches[0].files.map((f) => f.id)).toEqual(['j12-a', 'j12-b']);
    expect(batches[1].files.map((f) => f.id)).toEqual(['j11-a', 'j11-b']);
    expect(batches[0].date).toBe('12 oct');
  });

  it('sin rótulo, agrupa por día y el día hace de rótulo', () => {
    const files = [
      file({ id: 'a', created_at: '2026-10-03T08:00:00Z' }),
      file({ id: 'b', created_at: '2026-10-03T20:00:00Z' }),
      file({ id: 'c', created_at: '2026-10-04T08:00:00Z' }),
    ];
    const batches = groupFilesByBatch(files);
    expect(batches.map((b) => b.label)).toEqual(['4 oct', '3 oct']);
    expect(batches[1].files).toHaveLength(2);
  });

  it('el día es el local, el mismo que el rótulo: la misma noche no se parte en dos', () => {
    // Los tests corren en TZ=UTC (vitest.config); se simula Madrid desplazando
    // la hora: 23:30Z del 3 y 08:00Z del 4 son el mismo día solo si la clave y
    // el rótulo usan el mismo calendario. En UTC son días distintos y deben
    // salir dos lotes con rótulos distintos, nunca dos lotes con el mismo rótulo.
    const files = [
      file({ id: 'noche', created_at: '2026-10-03T23:30:00Z' }),
      file({ id: 'manana', created_at: '2026-10-04T08:00:00Z' }),
    ];
    const batches = groupFilesByBatch(files);
    const labels = batches.map((b) => b.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('enlaces', () => {
  it('elige el enlace más reciente y devuelve null sin enlaces', () => {
    expect(latestInvite(null)).toBeNull();
    expect(latestInvite([])).toBeNull();
    const a = { id: 'a', expires_at: '2026-10-12T00:00:00Z' };
    const b = { id: 'b', expires_at: '2026-10-13T00:00:00Z' };
    expect(latestInvite([a, b])?.id).toBe('b');
    expect(latestInvite([b, a])?.id).toBe('b');
  });
});

describe('archivos', () => {
  it('distingue imagen, vídeo y otros, por tipo o por extensión', () => {
    expect(fileKind('image/heic')).toBe('image');
    expect(fileKind('video/quicktime')).toBe('video');
    expect(fileKind('', 'IMG_1.HEIC')).toBe('image');
    expect(fileKind(null, 'gol.mov')).toBe('video');
    expect(fileKind('application/pdf', 'x.pdf')).toBe('other');
  });

  it('rechaza lo que pesa de más, lo vacío y lo que no es imagen ni vídeo', () => {
    expect(checkUploadable({ name: 'a.jpg', size: 5_000_000, type: 'image/jpeg' })).toBeNull();
    expect(
      checkUploadable({ name: 'a.jpg', size: MAX_FILE_BYTES + 1, type: 'image/jpeg' })
    ).toMatch(/máximo/);
    expect(checkUploadable({ name: 'a.jpg', size: 0, type: 'image/jpeg' })).toMatch(/vacío/);
    expect(checkUploadable({ name: 'a.pdf', size: 10, type: 'application/pdf' })).toMatch(
      /no es una imagen/
    );
    // Safari no pone tipo a los HEIC: vale la extensión.
    expect(checkUploadable({ name: 'IMG_2.heic', size: 10, type: '' })).toBeNull();
  });

  it('coloca el archivo y su miniatura bajo el jugador', () => {
    expect(storagePaths('p1', 'f1', 'IMG_4471.JPG')).toEqual({
      path: 'p1/f1.jpg',
      thumbPath: 'p1/f1.thumb.jpg',
    });
    expect(storagePaths('p1', 'f2', 'sin-extension').path).toBe('p1/f2.bin');
  });

  it('escribe los tamaños con coma', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(6_500_000)).toBe('6,2 MB');
    expect(formatBytes(41 * 1024 * 1024)).toBe('41,0 MB');
  });
});

describe('la ficha en la lista', () => {
  const now = new Date('2026-10-12T12:00:00Z');

  it('cuenta lo que queda del enlace', () => {
    expect(expiresInLabel('2026-10-13T09:30:00Z', now)).toBe('21 h');
    expect(expiresInLabel('2026-10-12T12:35:00Z', now)).toBe('35 min');
    expect(expiresInLabel('2026-10-12T11:00:00Z', now)).toBeNull();
  });

  it('describe la ficha según tenga cuenta o enlace', () => {
    const counts = { fotos: 48, matchdays: 6 };
    expect(playerSubtitle({ hasAccount: true, counts, inviteExpiresAt: null }, now)).toBe(
      'Con cuenta · Fotos 48 · Matchdays 6'
    );
    expect(
      playerSubtitle({ hasAccount: false, counts, inviteExpiresAt: '2026-10-13T09:30:00Z' }, now)
    ).toBe('Sin cuenta · enlace caduca en 21 h');
    expect(
      playerSubtitle({ hasAccount: false, counts, inviteExpiresAt: '2026-10-11T09:30:00Z' }, now)
    ).toBe('Sin cuenta');
  });

  it('saca iniciales', () => {
    expect(playerInitials('Juan Cruz')).toBe('JC');
    expect(playerInitials('Dani')).toBe('DA');
    expect(playerInitials('')).toBe('?');
  });
});
