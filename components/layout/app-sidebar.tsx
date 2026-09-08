'use client';

/**
 * AppSidebar — sidebar flotante PHSPORT (lenguaje del concepto D).
 *
 * Movimiento estilo Apple: el ancho de la placa se anima con MUELLE
 * (SPRINGS.smooth), el contenido principal se desplaza con el mismo muelle
 * (ver MainArea en app-layout), y las etiquetas hacen FADE de opacidad —
 * nunca aparecen/desaparecen de golpe. La pill activa se desliza entre items
 * (layoutId compartido).
 *
 * Uso:
 *   <SidebarProvider>
 *     <AppSidebar />
 *     ...resto del layout (consume `useSidebar()` para el padding reactivo)
 *   </SidebarProvider>
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { SPRINGS, TWEENS } from '@/components/ui/animations';
import {
  CalendarRange,
  HelpCircle,
  Home,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from 'lucide-react';
import { Hint } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth/auth-context';
import { PhSportMark } from '@/components/layout/ph-sport-mark';
import { cn } from '@/lib/utils';

// ─── Constantes (px, como el concepto D) ─────────────────────
const W_EXPANDED = 224;   // placa expandida
const W_COLLAPSED = 64;   // placa colapsada (solo iconos)
const SIDE_INSET = 12;    // margen de la placa a los bordes (left/top/bottom-3)
const GAP = 12;           // hueco entre placa y contenido
const MOBILE_MAX = 767;   // breakpoint móvil
const COOKIE_KEY = 'phsp-sb';

// ─── Context API ──────────────────────────────────────────────

type SidebarApi = {
  expanded: boolean;
  toggle: () => void;
  isMobile: boolean;
  /** Padding-left (px) que el contenido reserva para esquivar la placa + gap. */
  contentPadLeft: number;
};

const SidebarCtx = createContext<SidebarApi | null>(null);

export function useSidebar(): SidebarApi {
  const ctx = useContext(SidebarCtx);
  if (!ctx) throw new Error('useSidebar() debe usarse dentro de <SidebarProvider>');
  return ctx;
}

export function SidebarProvider({
  children,
  defaultExpanded = true,
}: {
  children: ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [isMobile, setIsMobile] = useState(false);
  const restored = useRef(false);

  // Restaurar de cookie una sola vez
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const m = document.cookie.match(new RegExp(`${COOKIE_KEY}=([^;]+)`));
    if (m) setExpanded(m[1] === '1');
  }, []);

  // Track viewport
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const toggle = useCallback(() => {
    // En móvil no hay placa que plegar: la navegación vive en la tab bar inferior.
    if (isMobile) return;
    setExpanded((prev) => {
      const next = !prev;
      document.cookie = `${COOKIE_KEY}=${next ? '1' : '0'}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      return next;
    });
  }, [isMobile]);

  // Cmd/Ctrl + B
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  const api = useMemo<SidebarApi>(() => {
    const w = expanded ? W_EXPANDED : W_COLLAPSED;
    return {
      expanded,
      toggle,
      isMobile,
      contentPadLeft: isMobile ? 0 : w + SIDE_INSET + GAP,
    };
  }, [expanded, toggle, isMobile]);

  return <SidebarCtx.Provider value={api}>{children}</SidebarCtx.Provider>;
}

// ─── Configuración de navegación ─────────────────────────────

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export function buildNavItems(role: 'ADMIN' | 'DESIGNER' | undefined): NavItem[] {
  return [
    { href: '/inicio', label: 'Inicio', icon: Home },
    // Vista semanal de trabajo: el equipo (mánager) o la cola propia (diseñador).
    role === 'ADMIN'
      ? { href: '/equipo', label: 'Semana', icon: CalendarRange }
      : { href: '/mi-semana', label: 'Semana', icon: CalendarRange },
    { href: '/disenos', label: 'Diseños', icon: Palette },
  ];
}

export function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

// ─── AppSidebar (entry point) ────────────────────────────────

export function AppSidebar() {
  const { expanded } = useSidebar();
  const { profile } = useAuth();
  const pathname = usePathname() ?? '';
  const items = buildNavItems(profile?.role);

  // Solo escritorio (hidden md:flex): en móvil la navegación es la MobileTabBar.
  return (
    <motion.aside
      initial={false}
      animate={{ width: expanded ? W_EXPANDED : W_COLLAPSED }}
      transition={SPRINGS.smooth}
      data-state={expanded ? 'expanded' : 'collapsed'}
      aria-label="Navegación principal"
      className={cn(
        'glass-sidebar fixed bottom-3 left-3 top-3 z-30 hidden flex-col overflow-hidden',
        'rounded-2xl shadow-overlay md:flex'
      )}
    >
      <SidebarBody items={items} pathname={pathname} expanded={expanded} showToggle />
    </motion.aside>
  );
}

// ─── Cuerpo compartido (mobile + desktop) ────────────────────

function SidebarBody({
  items,
  pathname,
  expanded,
  onItemClick,
  showToggle,
}: {
  items: NavItem[];
  pathname: string;
  expanded: boolean;
  onItemClick?: () => void;
  showToggle: boolean;
}) {
  return (
    <div className="flex h-full flex-col p-3">
      <SidebarBrand expanded={expanded} onLinkClick={onItemClick} />

      <nav className="mt-5 flex flex-1 flex-col gap-1.5" aria-label="Secciones">
        {items.map((item) => (
          <NavRow
            key={item.href}
            item={item}
            active={isItemActive(pathname, item.href)}
            expanded={expanded}
            onClick={onItemClick}
          />
        ))}
      </nav>

      <div className="flex flex-col gap-1.5 border-t border-sidebar-border/60 pt-3">
        {/* Ayuda vive en el pie, no entre las secciones de arriba: se consulta
            de uvas a peras y no compite con el trabajo del día. */}
        <NavRow
          item={{ href: '/ayuda', label: 'Ayuda', icon: HelpCircle }}
          active={isItemActive(pathname, '/ayuda')}
          expanded={expanded}
          onClick={onItemClick}
        />
        <NavRow
          item={{ href: '/ajustes', label: 'Ajustes', icon: Settings }}
          active={isItemActive(pathname, '/ajustes')}
          expanded={expanded}
          onClick={onItemClick}
        />
        {showToggle && <ToggleRow expanded={expanded} />}
      </div>
    </div>
  );
}

// ─── Marca ───────────────────────────────────────────────────

function SidebarBrand({ expanded, onLinkClick }: { expanded: boolean; onLinkClick?: () => void }) {
  return (
    <Link
      href="/inicio"
      onClick={onLinkClick}
      aria-label="PHSPORT — Inicio"
      className="flex h-10 items-center overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center">
        <PhSportMark decorative className="h-6 text-sidebar-foreground" />
      </span>
      <motion.span
        initial={false}
        animate={{ opacity: expanded ? 1 : 0 }}
        transition={TWEENS.fast}
        className="whitespace-nowrap font-heading text-sm font-semibold tracking-tight text-sidebar-foreground"
      >
        PHSPORT
      </motion.span>
    </Link>
  );
}

// ─── Item ────────────────────────────────────────────────────

function NavRow({
  item,
  active,
  expanded,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  expanded: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Hint label={!expanded ? item.label : undefined} side="right" sideOffset={20}>
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        // h-11 en táctil (objetivo ≥44px); h-10 con puntero de escritorio
        'relative flex h-11 items-center overflow-hidden rounded-xl px-[10px] outline-none transition-colors md:h-10',
        'focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset',
        active
          ? 'text-primary'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-hover hover:text-sidebar-foreground'
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active-pill"
          transition={SPRINGS.smooth}
          className="absolute inset-0 rounded-xl bg-primary/15"
          aria-hidden
        />
      )}
      <Icon className="relative z-10 h-5 w-5 shrink-0" aria-hidden />
      <motion.span
        initial={false}
        animate={{ opacity: expanded ? 1 : 0 }}
        transition={TWEENS.fast}
        className="relative z-10 ml-3 truncate whitespace-nowrap text-sm font-medium"
      >
        {item.label}
      </motion.span>
    </Link>
    </Hint>
  );
}

// ─── Toggle (footer) ─────────────────────────────────────────

function ToggleRow({ expanded }: { expanded: boolean }) {
  const { toggle } = useSidebar();
  const Icon = expanded ? PanelLeftClose : PanelLeftOpen;
  const label = expanded ? 'Contraer' : 'Expandir';
  return (
    <Hint label={!expanded ? `${label} (⌘B)` : undefined} side="right" sideOffset={20}>
    <button
      type="button"
      onClick={toggle}
      aria-label={`${label} barra lateral`}
      className={cn(
        'flex h-10 items-center overflow-hidden rounded-xl px-[10px] outline-none transition-colors',
        'text-sidebar-foreground/70 hover:bg-sidebar-hover hover:text-sidebar-foreground',
        'focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset'
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <motion.span
        initial={false}
        animate={{ opacity: expanded ? 1 : 0 }}
        transition={TWEENS.fast}
        className="ml-3 whitespace-nowrap text-sm font-medium"
      >
        Contraer
      </motion.span>
    </button>
    </Hint>
  );
}
