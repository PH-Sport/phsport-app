'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { SPRINGS } from '@/components/ui/animations';
import { Collapse } from '@/components/ui/collapse';
import { Surface } from '@/components/ui/surface';
import { splitCoach, type PortfolioCategory } from '@/lib/utils/campograma';

/**
 * Los entrenadores, aparte y con los de todas las categorías. Dentro del campo no
 * encajan, porque no ocupan demarcación: se probaron tres formas en el campograma
 * suelto y siempre parecían un jugador más. Por categoría, varias quedarían vacías.
 */
export function Coaches({
  categories,
  onOpenCoach,
}: {
  categories: PortfolioCategory[];
  onOpenCoach: (categoryId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const withCoach = categories.filter((c) => c.coach);
  if (withCoach.length === 0) return null;

  return (
    <Surface variant="grouped" padded={false} className="overflow-hidden">
      <button
        type="button"
        data-coaches-toggle
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold">Entrenadores</span>
        <span className="text-xs tabular-nums text-muted-foreground">{withCoach.length}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={SPRINGS.snappy}
          className="ml-auto text-muted-foreground"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>
      <Collapse open={open}>
        <ul className="border-t border-border py-1">
          {withCoach.map((c) => {
            const { name, team } = splitCoach(c.coach ?? '');
            return (
              <li key={c.id}>
                <button
                  type="button"
                  data-coach
                  onClick={() => onOpenCoach(c.id)}
                  className="flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">{team ?? c.shortName}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Collapse>
    </Surface>
  );
}
