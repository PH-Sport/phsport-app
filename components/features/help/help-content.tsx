'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { RowSeparator } from '@/components/ui/row';
import { SPRINGS, STAGGER } from '@/components/ui/animations';
import { useAuth } from '@/lib/auth/auth-context';
import { useDismissedTips } from '@/lib/help/use-dismissed-tips';
import { groupTipsBySection, searchTips, tipsForRole } from '@/lib/help/select';
import { cn } from '@/lib/utils';

const rise = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: SPRINGS.gentle },
};

/** Cuánto se queda marcado el consejo al que apunta el enlace. */
const HIGHLIGHT_MS = 2600;

/**
 * Cuerpo de /ayuda — los consejos para leer con calma.
 *
 * Aquí el texto va SIEMPRE a la vista, sin plegar: esta pantalla existe justo
 * para leerlos del tirón, y esconder cada uno tras un clic la convertiría en
 * un índice. Lo que se pliega es la interfaz de trabajo, no la ayuda.
 */
export function HelpContent() {
  const { profile } = useAuth();
  const { ready, dismissedCount, restoreAll } = useDismissedTips();
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = useMemo(() => tipsForRole(profile?.role), [profile?.role]);
  const matches = useMemo(() => searchTips(visible, query), [visible, query]);
  const groups = useMemo(() => groupTipsBySection(matches), [matches]);

  // Enlaces del tipo /ayuda#carga-capacidad — los que deja el «?» de la
  // interfaz. El navegador no salta solo cuando el ancla se pinta después de
  // montar, así que lo hacemos aquí y de paso lo marcamos: sin la marca, caer
  // en mitad de una lista larga no dice cuál de todos era el que buscabas.
  useEffect(() => {
    const jump = () => {
      const id = window.location.hash.slice(1);
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setHighlighted(id);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
    };

    jump();
    window.addEventListener('hashchange', jump);
    return () => {
      window.removeEventListener('hashchange', jump);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);

  const searching = query.trim().length > 0;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: STAGGER } } }}
      className="max-w-2xl space-y-xl pb-xl"
    >
      <motion.div variants={rise} className="space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en la ayuda…"
            aria-label="Buscar en la ayuda"
            className="pl-9"
          />
        </div>

        {searching && (
          <p className="text-sm text-muted-foreground" role="status">
            {matches.length === 0
              ? 'Ningún consejo casa con eso.'
              : `${matches.length} de ${visible.length} consejos.`}
          </p>
        )}

        {/* Solo aparece si de verdad hay algo oculto: un botón para restaurar
            cero avisos sobra en la pantalla y confunde más de lo que ayuda. */}
        {ready && dismissedCount > 0 && !searching && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Has ocultado {dismissedCount}{' '}
              {dismissedCount === 1 ? 'aviso' : 'avisos'} en este dispositivo.
            </p>
            <Button variant="ghost" size="sm" onClick={restoreAll} className="text-muted-foreground">
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Volver a mostrarlos
            </Button>
          </div>
        )}
      </motion.div>

      {groups.map((group) => (
        <motion.section key={group.id} variants={rise}>
          <p className="text-eyebrow text-primary">{group.label}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{group.hint}</p>
          <Surface variant="grouped" className="mt-3">
            <ul className="-mx-2">
              {group.tips.map((tip, i) => (
                <li key={tip.id}>
                  <article
                    id={tip.id}
                    // La cabecera flota sobre el contenido: sin este margen de
                    // scroll, el ancla aterriza medio tapada por ella.
                    className={cn(
                      'scroll-mt-24 rounded-xl px-2 py-3 transition-shadow duration-300 ease-out-expo md:py-2.5',
                      highlighted === tip.id && 'ring-2 ring-primary/50'
                    )}
                  >
                    <h3 className="text-sm font-semibold text-foreground">{tip.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{tip.body}</p>
                  </article>
                  {/* 8px = el px-2 de la fila, descontado el -mx-2 de la lista:
                      el filete arranca justo bajo la primera letra del título. */}
                  {i < group.tips.length - 1 && <RowSeparator inset={8} />}
                </li>
              ))}
            </ul>
          </Surface>
        </motion.section>
      ))}
    </motion.div>
  );
}
