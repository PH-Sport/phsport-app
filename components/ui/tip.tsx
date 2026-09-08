'use client';

import Link from 'next/link';
import { Lightbulb, X } from 'lucide-react';
import { Collapse } from '@/components/ui/collapse';
import { findTip } from '@/lib/help/select';
import { useDismissedTips } from '@/lib/help/use-dismissed-tips';
import { cn } from '@/lib/utils';

interface TipProps {
  /** Id de `lib/help/tips.ts`. Un id inexistente no pinta nada. */
  tipId: string;
  className?: string;
}

/**
 * Aviso contextual — el consejo que se pinta solo donde hace falta.
 *
 * Se coloca en la situación que confunde (una lista que sale vacía, una semana
 * sin nada), no «al entrar en la sección»: un aviso que sale siempre deja de
 * leerse a la segunda vez. Se descarta con la equis y no vuelve; para
 * recuperarlos todos hay un botón en /ayuda.
 *
 * Tono: hairline y fondo del acento al 5 %. Ni caja de error ni de peligro —
 * esto no avisa de que algo va mal, explica por qué se ve lo que se ve.
 */
export function Tip({ tipId, className }: TipProps) {
  const { ready, isDismissed, dismiss } = useDismissedTips();
  const tip = findTip(tipId);

  // Nada hasta haber leído el almacenamiento: pintarlo y retirarlo un
  // fotograma después sería un parpadeo justo donde se pide calma.
  const open = Boolean(tip) && ready && !isDismissed(tipId);

  if (!tip) return null;

  return (
    <Collapse open={open}>
      <div
        className={cn(
          'flex items-start gap-3 rounded-surface border border-primary/20 bg-primary/5 p-md md:rounded-2xl md:p-lg',
          className
        )}
      >
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{tip.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{tip.body}</p>
          <Link
            href="/ayuda"
            className="mt-2 inline-block text-sm font-medium text-primary outline-none hover:underline focus-visible:underline"
          >
            Ver todos los consejos
          </Link>
        </div>

        <button
          type="button"
          onClick={() => dismiss(tip.id)}
          aria-label="Ocultar este consejo"
          className={cn(
            '-my-1.5 -mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
            'text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground',
            'focus-visible:ring-2 focus-visible:ring-ring md:h-8 md:w-8'
          )}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </Collapse>
  );
}
