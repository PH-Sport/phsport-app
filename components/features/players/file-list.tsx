'use client';

import { ChevronRight, Image as ImageIcon, Video } from 'lucide-react';
import { RowSeparator } from '@/components/ui/row';
import { fileKind, formatBytes, formatDay, type PlayerFile } from '@/lib/utils/players';
import { cn } from '@/lib/utils';

/**
 * Los envíos, en lista: lo que él mandó y nadie ha colocado aún. Una fila por
 * archivo con nombre, cuándo y cuánto pesa. Al tocar se abre la hoja del
 * archivo, donde están las acciones (mover, borrar, quitar).
 */
export function FileList({
  files,
  onSelect,
  emptyText,
  className,
}: {
  files: PlayerFile[];
  onSelect: (file: PlayerFile) => void;
  emptyText: string;
  className?: string;
}) {
  if (files.length === 0) {
    return <p className="px-2 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className={cn('overflow-hidden rounded-surface bg-card shadow-raised', className)}>
      {files.map((file, i) => {
        const Icon = fileKind(file.mime_type, file.name) === 'video' ? Video : ImageIcon;
        return (
          <li key={file.id}>
            {/* 16 de padding + 40 de icono + 14 de hueco = 70 */}
            {i > 0 && <RowSeparator inset={70} />}
            <button
              type="button"
              onClick={() => onSelect(file)}
              className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{file.name}</span>
                <span className="font-mono tabular text-xs text-muted-foreground">
                  {formatDay(file.created_at)} · {formatBytes(file.size_bytes)}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
