'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronDown, Crown, Eye, UserCog } from 'lucide-react';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { SPRINGS } from '@/components/ui/animations';
import { Collapse } from '@/components/ui/collapse';
import { useViewAs } from '@/lib/auth/view-as-context';
import { useDesigners } from '@/lib/hooks/use-designers';

/**
 * Sección "Ver como" del menú de cuenta. Solo se RENDERIZA para cuentas dev,
 * por lo que useDesigners() solo se ejecuta para el dev (no para usuarios normales).
 *
 * Cabecera plegable (mismo patrón que "Zona avanzada" en Miembros): plegada
 * muestra el activo ("Ver como · Pau"); al desplegar aparecen Mánager +
 * diseñadores con la extensión suave. El toggle NO cierra el menú
 * (onSelect preventDefault), así se navega sin salir del popover.
 */
export function ViewAsMenuSection() {
  const {
    simulating,
    simulatedDesignerId,
    simulatedDesignerName,
    enterDesignerView,
    exitToManager,
  } = useViewAs();
  const { designers } = useDesigners();
  const [open, setOpen] = useState(false);

  const activeLabel = simulating ? simulatedDesignerName : 'Mánager';

  return (
    <>
      <DropdownMenuSeparator className="bg-border" />
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="cursor-pointer text-muted-foreground hover:bg-accent focus:bg-accent"
      >
        <Eye className="mr-2 h-4 w-4" />
        <span className="flex-1 truncate text-[11px] md:text-[10px] font-semibold uppercase tracking-wider">
          Ver como
          {activeLabel && (
            <span className="ml-1 normal-case text-muted-foreground/80">· {activeLabel}</span>
          )}
        </span>
        <motion.span
          initial={false}
          animate={{ rotate: open ? 0 : -90 }}
          transition={SPRINGS.snappy}
          className="ml-2 shrink-0"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </DropdownMenuItem>

      <Collapse open={open}>
        <DropdownMenuItem
          onClick={exitToManager}
          className="cursor-pointer text-foreground hover:bg-accent"
        >
          <Crown className="mr-2 h-4 w-4 text-primary" />
          <span className="flex-1">Mánager</span>
          {!simulating && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>
        {designers.map((d) => (
          <DropdownMenuItem
            key={d.id}
            onClick={() => enterDesignerView(d)}
            className="cursor-pointer text-foreground hover:bg-accent"
          >
            <UserCog className="mr-2 h-4 w-4 text-role-designer" />
            <span className="flex-1 truncate">{d.displayName}</span>
            {simulating && simulatedDesignerId === d.id && (
              <Check className="h-4 w-4 text-role-designer" />
            )}
          </DropdownMenuItem>
        ))}
      </Collapse>
    </>
  );
}
