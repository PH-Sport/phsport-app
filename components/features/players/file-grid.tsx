'use client';

import { Image as ImageIcon, Video } from 'lucide-react';
import { useThumbUrls } from '@/lib/hooks/use-thumb-urls';
import { fileKind, groupFilesByBatch, type PlayerFile } from '@/lib/utils/players';
import { cn } from '@/lib/utils';

/**
 * Los archivos de una carpeta, por lotes (spec §6): un rótulo con la fecha y
 * una rejilla de tres. Los lotes NO son subcarpetas; no hay un nivel más.
 * La misma rejilla la usan la agencia y el jugador.
 */
export function FileGrid({
  files,
  onSelect,
  emptyText,
}: {
  files: PlayerFile[];
  onSelect: (file: PlayerFile) => void;
  emptyText: string;
}) {
  const thumbs = useThumbUrls(files);
  const batches = groupFilesByBatch(files);

  if (batches.length === 0) {
    return <p className="px-2 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="space-y-6">
      {batches.map((batch) => (
        <section key={batch.key}>
          <div className="mb-2.5 flex items-baseline gap-2.5">
            <h2 className="text-[17px] font-semibold">{batch.label}</h2>
            <span className="font-mono tabular text-xs text-muted-foreground">
              {batch.date} · {batch.files.length}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {batch.files.map((file) => (
              <FileTile key={file.id} file={file} thumb={file.thumb_path ? thumbs[file.thumb_path] : undefined} onSelect={onSelect} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FileTile({
  file,
  thumb,
  onSelect,
}: {
  file: PlayerFile;
  thumb?: string;
  onSelect: (file: PlayerFile) => void;
}) {
  const kind = fileKind(file.mime_type, file.name);
  const Icon = kind === 'video' ? Video : ImageIcon;
  return (
    <button
      type="button"
      onClick={() => onSelect(file)}
      aria-label={file.name}
      className={cn(
        'relative aspect-square overflow-hidden rounded-[10px] bg-muted outline-none transition-opacity active:opacity-80',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      )}
    >
      {thumb ? (
        // La miniatura viene firmada y caduca: next/image no la puede cachear
        // ni optimizar, y el plan gratuito tampoco. Es una <img> a propósito.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-muted-foreground">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
      )}
      {kind === 'video' && thumb && (
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/55 p-1 text-white">
          <Video className="h-3.5 w-3.5" aria-hidden />
        </span>
      )}
    </button>
  );
}
