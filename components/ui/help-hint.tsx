'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { ArrowRight, HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { findTip } from '@/lib/help/select';
import { cn } from '@/lib/utils';

interface HelpHintProps {
  /** Id de `lib/help/tips.ts`. Un id inexistente no pinta nada. */
  tipId: string;
  /**
   * Disparador propio, cuando lo que se explica ya es un elemento en pantalla
   * (una píldora, un rótulo). Sin él se dibuja el «?» de siempre.
   */
  children?: ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
}

/**
 * El «?» que explica un concepto sin salir de donde estás.
 *
 * Popover y no tooltip a propósito: un tooltip necesita puntero y esta app se
 * usa sobre todo desde el móvil, donde no hay hover que valga. Aquí no se
 * descarta nada — está siempre disponible, y solo aparece si lo pides.
 */
export function HelpHint({
  tipId,
  children,
  side = 'top',
  align = 'center',
  className,
}: HelpHintProps) {
  const tip = findTip(tipId);
  // Si el catálogo cambia y un id se queda huérfano, la pantalla que lo usaba
  // sigue funcionando sin el «?». Un consejo no vale una pantalla rota.
  if (!tip) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children ?? (
          <button
            type="button"
            aria-label={`Qué significa: ${tip.title}`}
            className={cn(
              // El icono ocupa 16px y el padding lo lleva a 32 de área tocable.
              // El margen negativo es SOLO vertical: así no engorda la fila,
              // pero conserva su hueco horizontal y no se pega a lo de al lado.
              '-my-2 inline-flex shrink-0 rounded-full p-2 text-muted-foreground outline-none',
              'transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
              className
            )}
          >
            <HelpCircle className="h-4 w-4" aria-hidden />
          </button>
        )}
      </PopoverTrigger>
      {/* max-w frente al ancho fijo: en un móvil estrecho un w-80 se sale. */}
      <PopoverContent side={side} align={align} className="w-80 max-w-[calc(100vw-2rem)]">
        <p className="text-sm font-semibold text-foreground">{tip.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{tip.body}</p>
        <Link
          href={`/ayuda#${tip.id}`}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary outline-none hover:underline focus-visible:underline"
        >
          Ver más consejos
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </PopoverContent>
    </Popover>
  );
}
