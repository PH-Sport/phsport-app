'use client';

import { useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTriggerSliding } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { SIGNALS, type PortfolioCategory, type Signal } from '@/lib/utils/campograma';

function Tally({
  total,
  bySignal,
  onOpenSignal,
}: {
  total: number;
  bySignal: Record<Signal, number>;
  onOpenSignal: (signal: Signal) => void;
}) {
  const cell = (value: number, label: string) => (
    <>
      <b className="block text-xl font-semibold leading-tight tabular-nums">{value}</b>
      <span className="block text-xs text-muted-foreground">{label}</span>
    </>
  );
  const SHORT_LABEL: Record<Signal, string> = { loaned: 'En cesión', pending: 'Pte. mov.', noClub: 'Sin club' };

  return (
    <div className="flex items-start gap-6">
      <div>{cell(total, 'Jugadores')}</div>
      {(Object.keys(SIGNALS) as Signal[]).map((signal) => (
        <button
          key={signal}
          type="button"
          data-signal={signal}
          disabled={bySignal[signal] === 0}
          onClick={() => onOpenSignal(signal)}
          className="rounded-md text-left transition-opacity hover:opacity-70 disabled:pointer-events-none disabled:opacity-50"
        >
          {cell(bySignal[signal], SHORT_LABEL[signal])}
        </button>
      ))}
    </div>
  );
}

interface ToolbarProps {
  categories: PortfolioCategory[];
  categoryId: string | undefined;
  onCategoryChange: (id: string) => void;
  /** Coincidencias por categoría; sin búsqueda, sus jugadores. */
  counts: Record<string, number>;
  query: string;
  onQueryChange: (query: string) => void;
  total: number;
  bySignal: Record<Signal, number>;
  onOpenSignal: (signal: Signal) => void;
  /** El selector de vista: nunca cede sitio, así que va fuera de lo que se encoge. */
  viewSwitch?: React.ReactNode;
}

export function Toolbar({
  categories,
  categoryId,
  onCategoryChange,
  counts,
  query,
  onQueryChange,
  total,
  bySignal,
  onOpenSignal,
  viewSwitch,
}: ToolbarProps) {
  const filtering = query.trim() !== '';
  const inputRef = useRef<HTMLInputElement>(null);
  // Por debajo de lg el buscador es una lupa; al abrirse ocupa el sitio del
  // desplegable en la misma fila.
  const [searchOpen, setSearchOpen] = useState(false);

  const closeSearchIfEmpty = () => {
    if (!query) setSearchOpen(false);
  };

  return (
    <div className="space-y-4">
      <Tally total={total} bySignal={bySignal} onOpenSignal={onOpenSignal} />

      {/* flex-nowrap, y no es un detalle: mientras la fila podía envolver, a mitad de
          transición la suma de anchos se pasaba, y el selector de vista bajaba de
          línea y volvía a subir. */}
      <div className="flex flex-nowrap items-center gap-2">
        <Tabs value={categoryId} onValueChange={onCategoryChange} className="hidden lg:block">
          <TabsList>
            {categories.map((c) => (
              <TabsTriggerSliding
                key={c.id}
                value={c.id}
                active={c.id === categoryId}
                indicatorId="campograma-categoria"
              >
                {c.shortName}
                <span
                  className={cn(
                    'ml-1.5 text-xs tabular-nums text-muted-foreground',
                    filtering && (counts[c.id] ?? 0) > 0 && 'font-semibold text-primary'
                  )}
                >
                  {counts[c.id] ?? 0}
                </span>
              </TabsTriggerSliding>
            ))}
          </TabsList>
        </Tabs>

        {/* Un <select> nativo abre la rueda del sistema y no hay que inventarse la
            accesibilidad. text-base: con menos, Safari de iOS hace zoom al tocarlo. */}
        <div className={cn('relative min-w-0 flex-1 lg:hidden', searchOpen && 'hidden')}>
          <select
            aria-label="Categoría"
            value={categoryId}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="h-10 w-full appearance-none truncate rounded-lg border border-input bg-card pl-3 pr-8 text-base text-foreground"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortName} · {counts[c.id] ?? 0}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>

        <button
          type="button"
          aria-label="Buscar"
          aria-expanded={searchOpen}
          onClick={() => {
            setSearchOpen(true);
            // El campo acaba de dejar de estar oculto: hasta el siguiente pintado no
            // se le puede dar el foco.
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-input bg-card text-muted-foreground lg:hidden',
            searchOpen && 'hidden'
          )}
        >
          <Search className="h-4 w-4" />
        </button>

        <div className={cn('relative min-w-0 flex-1 lg:block', searchOpen ? 'block' : 'hidden')}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onBlur={closeSearchIfEmpty}
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return;
              onQueryChange('');
              setSearchOpen(false);
              e.currentTarget.blur();
            }}
            placeholder="Buscar jugador o club…"
            aria-label="Buscar jugador o club"
            autoComplete="off"
            className="h-10 pl-9 pr-9 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query && (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => {
                onQueryChange('');
                setSearchOpen(false);
              }}
              className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {viewSwitch && <div className="flex-none">{viewSwitch}</div>}
      </div>
    </div>
  );
}

/** Sin coincidencias en la categoría elegida: se ofrece saltar a las que sí tienen. */
export function NoResults({
  category,
  categories,
  counts,
  onJump,
}: {
  category: PortfolioCategory | undefined;
  categories: PortfolioCategory[];
  counts: Record<string, number>;
  onJump: (id: string) => void;
}) {
  const others = categories.filter((c) => c.id !== category?.id && (counts[c.id] ?? 0) > 0);
  return (
    <div
      data-no-results
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm"
    >
      <b className="font-semibold">Sin resultados en {category?.shortName}</b>
      {others.length > 0 ? (
        others.map((c) => (
          <button
            key={c.id}
            type="button"
            data-jump={c.id}
            onClick={() => onJump(c.id)}
            className="rounded-full border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent"
          >
            {c.shortName} <span className="tabular-nums text-primary">{counts[c.id]}</span>
          </button>
        ))
      ) : (
        <span className="text-muted-foreground">Prueba con otro nombre o club.</span>
      )}
    </div>
  );
}
