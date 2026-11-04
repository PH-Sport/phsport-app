'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Check } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { THEME_MODES } from '@/lib/theme/theme-modes';
import { useAccentColor } from '@/lib/theme/use-accent-color';
import { accentSwatch, accentSwatchForeground } from '@/lib/theme/accent-colors';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DefaultView } from '@/lib/hooks/use-user-preferences';

interface AppearanceTabProps {
  defaultView: DefaultView;
  /** A quien solo es de Agentes no le dice nada cómo se abre Diseños: no lo ve. */
  showDesignPreferences: boolean;
  onDefaultViewChange: (v: DefaultView) => void;
}

// Los tres modos viven en lib/theme/theme-modes.ts: aquí y en el menú de
// perfil se pintan los mismos, sin duplicar la lista.

export function AppearanceTab({ defaultView, onDefaultViewChange, showDesignPreferences }: AppearanceTabProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { accent, setAccent, options: accentOptions } = useAccentColor();
  // Evita mismatch de hidratación: ni el tema ni el acento se conocen en SSR
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // La muestra refleja el modo activo (sólido en claro, pastel en oscuro).
  // Antes de montar = claro, igual que el render de SSR (sin mismatch).
  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <div className="space-y-lg py-2">
      <div className="space-y-3">
        <Label>Tema</Label>
        <div className="grid grid-cols-3 gap-3">
          {THEME_MODES.map(({ value, label, icon: Icon }) => {
            const active = mounted && theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={active}
                className={cn(
                  // Móvil: icono sobre etiqueta — «Dispositivo» no cabe al lado
                  // del icono en un tercio de pantalla. En md+ vuelve a una fila.
                  'flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-3 text-xs font-medium transition-colors',
                  'md:flex-row md:gap-2 md:px-3 md:py-2.5 md:text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
                  active
                    ? 'border-primary/50 bg-primary/10 text-foreground'
                    : 'border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground">
          Se aplica al instante y se recuerda en este navegador.
        </p>
      </div>

      <div className="space-y-3">
        <Label>Color de acento</Label>
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Color de acento">
          {accentOptions.map((color) => {
            const active = mounted && accent === color.key;
            return (
              <button
                key={color.key}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={color.label}
                onClick={() => setAccent(color.key)}
                style={{ backgroundColor: accentSwatch(color, isDark) }}
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-full transition-transform md:h-8 md:w-8',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
                  active
                    ? 'ring-2 ring-foreground/80 ring-offset-2 ring-offset-background'
                    : 'hover:scale-110'
                )}
              >
                {active && (
                  <Check
                    className="h-4 w-4"
                    style={{ color: accentSwatchForeground(color, isDark) }}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground">
          Tiñe botones, enlaces y elementos activos. Te sigue en todos tus dispositivos.
        </p>
      </div>

      {showDesignPreferences && (
        <div className="space-y-3">
          <Label>Vista predeterminada de Diseños</Label>
          <Select
            value={defaultView}
            onValueChange={(value) => onDefaultViewChange(value as DefaultView)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona una vista" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="list">Lista</SelectItem>
              <SelectItem value="calendar">Calendario</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Cómo se abre la página de Diseños por defecto.
          </p>
        </div>
      )}
    </div>
  );
}
