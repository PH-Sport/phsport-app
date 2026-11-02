'use client';

import { useMemo, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { usePortfolioNames } from '@/lib/hooks/use-portfolio-names';
import { applySuggestion, suggestPlayers, type PortfolioName } from '@/lib/utils/player-suggestions';

interface PlayerInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * El campo «Jugador» de la tarjeta, con sugerencias de la cartera de Agentes.
 * Sigue admitiendo cualquier texto: quien no está en la cartera se escribe a
 * mano, como siempre.
 */
export function PlayerInput({ id, value, onChange }: PlayerInputProps) {
  const names = usePortfolioNames();
  const inputRef = useRef<HTMLInputElement>(null);
  // Abierta solo mientras se escribe: al elegir o al salir del campo se cierra
  // y no vuelve hasta la siguiente tecla.
  const [typing, setTyping] = useState(false);
  const [active, setActive] = useState(0);

  const suggestions = useMemo(() => suggestPlayers(names, value), [names, value]);
  const open = typing && suggestions.length > 0;
  const listId = `${id}-sugerencias`;

  function pick(player: PortfolioName) {
    onChange(applySuggestion(value, player.name));
    setTyping(false);
  }

  return (
    <Popover open={open} onOpenChange={(next) => !next && setTyping(false)}>
      <PopoverAnchor asChild>
        <Input
          ref={inputRef}
          id={id}
          className="h-10 md:h-9"
          value={value}
          placeholder="Nombre del jugador"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            onChange(e.target.value);
            setTyping(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            // Escape lo atiende la propia capa del popover, que cierra la lista
            // sin cerrar el diálogo de debajo.
            if (!open) return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const step = e.key === 'ArrowDown' ? 1 : -1;
              setActive((i) => (i + step + suggestions.length) % suggestions.length);
            } else if (e.key === 'Enter') {
              // Sin esto, Enter enviaría el formulario de crear diseños.
              e.preventDefault();
              pick(suggestions[Math.min(active, suggestions.length - 1)]);
            }
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        // El popover se anuncia como diálogo por defecto; aquí la caja entera
        // es la lista de opciones que controla el campo.
        id={listId}
        role="listbox"
        aria-label="Jugadores de la cartera"
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-1"
        // El foco se queda en el campo para seguir escribiendo.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        // Volver a pulsar en el campo no es «salir»: la lista sigue abierta.
        onInteractOutside={(e) => {
          if (inputRef.current?.contains(e.target as Node)) e.preventDefault();
        }}
      >
        {suggestions.map((player, i) => (
          <div
            key={`${player.name}|${player.team ?? ''}`}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            // Que el campo no pierda el foco al pulsar: el teclado del móvil
            // se queda abierto y la lista no se cierra antes de elegir.
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => pick(player)}
            onPointerMove={() => setActive(i)}
            className={cn(
              // Táctil: opciones ≥44px en móvil, como las de los desplegables.
              'flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors duration-200 md:min-h-0 md:py-1.5',
              i === active && 'bg-accent text-accent-foreground'
            )}
          >
            <span className="min-w-0 truncate">{player.name}</span>
            <span className="ml-auto max-w-[50%] shrink-0 truncate text-xs text-muted-foreground">
              {player.team ?? 'Club sin confirmar'}
            </span>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
