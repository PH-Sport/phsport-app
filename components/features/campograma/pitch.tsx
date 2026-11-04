'use client';

import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import {
  matchesSearch,
  PITCH_XY,
  POSITION_LABEL,
  POSITION_LINE,
  POSITION_ORDER,
  POSITION_SHORT,
  rotate,
  type PortfolioPlayer,
  type Position,
  type PositionLine,
} from '@/lib/utils/campograma';

/** Literales completos para que Tailwind los detecte. */
export const LINE_TEXT: Record<PositionLine, string> = {
  por: 'text-position-por',
  def: 'text-position-def',
  med: 'text-position-med',
  ata: 'text-position-ata',
};

/**
 * `preserveAspectRatio="none"` a propósito en las dos vistas: el campo se estira
 * con su caja, y por eso el círculo central es una elipse. No es un error.
 */
function PitchLines({ wide }: { wide: boolean }) {
  return (
    <svg
      className={cn(
        'absolute inset-0 h-full w-full text-white opacity-[var(--pitch-line-opacity)]',
        wide ? 'hidden lg:block' : 'lg:hidden'
      )}
      viewBox={wide ? '0 0 105 68' : '0 0 68 105'}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {wide ? (
        <g fill="none" stroke="currentColor" strokeWidth=".5">
          <rect x="1.5" y="1.5" width="102" height="65" />
          <line x1="52.5" y1="1.5" x2="52.5" y2="66.5" />
          <ellipse cx="52.5" cy="34" rx="9.15" ry="9.15" />
          <rect x="87" y="14" width="16.5" height="40" />
          <rect x="98" y="25" width="5.5" height="18" />
          <rect x="1.5" y="14" width="16.5" height="40" />
          <rect x="1.5" y="25" width="5.5" height="18" />
        </g>
      ) : (
        <g fill="none" stroke="currentColor" strokeWidth=".5">
          <rect x="1.5" y="1.5" width="65" height="102" />
          <line x1="1.5" y1="52.5" x2="66.5" y2="52.5" />
          <ellipse cx="34" cy="52.5" rx="9.15" ry="9.15" />
          <rect x="14" y="1.5" width="40" height="16.5" />
          <rect x="25" y="1.5" width="18" height="5.5" />
          <rect x="14" y="87" width="40" height="16.5" />
          <rect x="25" y="98" width="18" height="5.5" />
        </g>
      )}
    </svg>
  );
}

/** Las dos colocaciones viajan por CSS: el corte entre de pie y tumbado lo decide `lg:`. */
function placement(position: Position): CSSProperties {
  const [x, y] = PITCH_XY[position];
  const [xh, yh] = rotate(PITCH_XY[position]);
  return { '--x': `${x}%`, '--y': `${y}%`, '--xh': `${xh}%`, '--yh': `${yh}%` } as CSSProperties;
}

interface PitchProps {
  /** Los jugadores de la categoría elegida. */
  players: PortfolioPlayer[];
  query: string;
  onOpenPosition: (position: Position) => void;
}

/**
 * Los discos son demarcaciones, no jugadores (decisión de PH): van sin rótulo
 * debajo, con el código dentro y el nombre largo en `title` y `aria-label`.
 */
export function Pitch({ players, query, onOpenPosition }: PitchProps) {
  const filtering = query.trim() !== '';

  return (
    // Tumbado, el ancho sale del tope de alto: con `w-full` y `max-h` a la vez la
    // proporción se perdería y en un portátil el delantero se saldría de la pantalla.
    <div
      className={cn(
        'relative mx-auto aspect-[3/4] w-full max-w-[620px] overflow-hidden rounded-surface border border-border',
        'bg-gradient-to-b from-pitch-a to-pitch-b',
        'lg:aspect-[3/2] lg:w-[min(100%,calc((100dvh-250px)*1.5))] lg:max-w-none'
      )}
    >
      <PitchLines wide={false} />
      <PitchLines wide />

      {POSITION_ORDER.map((position) => {
        const inPosition = players.filter((p) => p.position === position);
        const matching = inPosition.filter((p) => matchesSearch(p, query)).length;
        const vacant = inPosition.length === 0;
        const off = filtering && matching === 0;
        const hit = filtering && matching > 0;
        const label = POSITION_LABEL[position];

        return (
          <button
            key={position}
            type="button"
            data-position={position}
            style={placement(position)}
            title={label}
            aria-label={`${label}, ${inPosition.length} jugadores`}
            disabled={off}
            onClick={() => onOpenPosition(position)}
            className={cn(
              'absolute left-[var(--x)] top-[var(--y)] z-[1] -translate-x-1/2 -translate-y-1/2 rounded-full',
              'lg:left-[var(--xh)] lg:top-[var(--yh)]',
              'transition-[opacity,transform] duration-150 hover:scale-[1.045] active:scale-[0.99]',
              LINE_TEXT[POSITION_LINE[position]],
              off && 'pointer-events-none opacity-20'
            )}
          >
            <span
              className={cn(
                'relative grid aspect-square w-[clamp(50px,13.5vw,68px)] place-items-center rounded-full border-2 border-current bg-card shadow-raised',
                vacant && 'border-dashed opacity-65',
                hit && 'shadow-[0_0_0_4px_color-mix(in_srgb,currentColor_22%,transparent)]'
              )}
            >
              <span className="text-[clamp(10px,2.7vw,12.5px)] font-medium tracking-wide">
                {POSITION_SHORT[position]}
              </span>
              {!vacant && (
                <span className="absolute -bottom-[3px] -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-current px-[5px] ring-2 ring-background">
                  <b className="text-[10.5px] font-semibold leading-none tabular-nums text-card">
                    {filtering ? matching : inPosition.length}
                  </b>
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
