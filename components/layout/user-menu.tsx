'use client';

import { useState, useRef, useCallback, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapse } from '@/components/ui/collapse';
import { RowSeparator } from '@/components/ui/row';
import {
  Check,
  ChevronDown,
  Crown,
  Eye,
  HelpCircle,
  LogOut,
  Settings,
  UserCog,
  Users,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SPRINGS } from '@/components/ui/animations';
import { useAuth } from '@/lib/auth/auth-context';
import { useViewAs } from '@/lib/auth/view-as-context';
import { useDesigners } from '@/lib/hooks/use-designers';
import { useIsMobile } from '@/lib/hooks/use-is-mobile';
import { VIEW_MODE_ACCENT, roleBadgeLabel } from '@/lib/utils/access';
import { ViewAsMenuSection } from './view-as-menu-section';
import { cn } from '@/lib/utils';

export function UserMenu() {
  const router = useRouter();
  // status/logout/access (efectivo) de useAuth; identidad REAL de useViewAs.
  const { status, logout, access } = useAuth();
  const { isDev, realName, realDisplayName, realEmail, realProfile, realViewMode, realAvatarUrl } =
    useViewAs();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Móvil: el perfil es una hoja desde abajo, la misma que Notificaciones
  // (asa, arrastrar o tocar fuera para cerrar). Escritorio: el desplegable.
  const isMobile = useIsMobile();
  // Altura medida en píxeles (subpíxel exacto) para el despliegue del menú.
  // Animar height a un número — en vez de 'auto' — evita el swap final de framer
  // (el "microcorte"). El ResizeObserver la mantiene al día, así el "Ver como"
  // interno también empuja la altura sin recortarse.
  const roRef = useRef<ResizeObserver | null>(null);
  const [menuHeight, setMenuHeight] = useState(0);

  // Callback ref: mide la altura real en píxeles (subpíxel exacto) en cuanto el
  // contenido monta en el portal, y la mantiene al día con ResizeObserver.
  // Animar height a ese número — en vez de 'auto' — evita el swap final de framer
  // (el "microcorte"); el RO deja crecer el "Ver como" interno sin recortarse.
  const measureRef = useCallback((node: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    if (!node) return;
    const measure = () => setMenuHeight(node.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    roRef.current = ro;
  }, []);

  const handleLogout = async () => {
    setLogoutDialogOpen(false);
    await logout();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    router.push('/login');
    router.refresh();
  };

  const authLoading = status === 'INITIALIZING';

  // Placeholders con la MISMA huella que el trigger real (44px móvil / 32px
  // escritorio): al resolver la auth no hay salto de layout en el header.
  if (authLoading) {
    return (
      <div className="flex h-11 w-11 items-center justify-center md:h-8 md:w-8">
        <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  if (!realEmail) {
    return (
      <div className="flex h-11 w-11 items-center justify-center md:h-8 md:w-8">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground">
          ?
        </span>
      </div>
    );
  }

  // Etiqueta corta (display_name) en el día a día; el avatar usa el nombre completo para las iniciales.
  const label = realDisplayName || realEmail.split('@')[0] || 'User';
  const avatarName = realName || label;
  const canMembers = access.can('invitar_personal') || access.can('gestionar_roles');

  // Táctil: el botón mide 44px aunque el avatar siga viéndose de 32px;
  // en escritorio vuelve a ceñirse al avatar. El ring abraza al avatar.
  const trigger = (
    <button
      type="button"
      aria-label={`Menú de usuario — ${label}`}
      className="flex h-11 w-11 items-center justify-center rounded-full outline-none md:h-8 md:w-8 [&>span]:ring-primary/40 [&>span]:transition-shadow hover:[&>span]:ring-2 focus-visible:[&>span]:ring-2 data-[state=open]:[&>span]:ring-2 data-[state=open]:[&>span]:ring-primary/60"
    >
      <UserAvatar
        name={avatarName}
        src={realAvatarUrl}
        className="h-8 w-8"
        fallbackClassName="bg-primary/15 text-xs font-semibold text-primary"
      />
    </button>
  );

  const logoutDialog = (
    <ConfirmDialog
      open={logoutDialogOpen}
      onOpenChange={setLogoutDialogOpen}
      title="¿Cerrar sesión?"
      description="Tendrás que volver a iniciar sesión para acceder a la aplicación."
      confirmLabel="Cerrar Sesión"
      cancelLabel="Cancelar"
      variant="warning"
      onConfirm={handleLogout}
      customIcon="/images/logo-ph-sport.svg"
    />
  );

  if (isMobile) {
    // Cerrar la hoja antes de navegar: si no, la página nueva aparece debajo
    // de la hoja que se está retirando.
    const go = (href: string) => {
      setMenuOpen(false);
      router.push(href);
    };
    return (
      <>
        <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogTrigger asChild>{trigger}</DialogTrigger>
          <DialogContent mobileSheet focusPanelOnOpen className="flex flex-col gap-0 p-0">
            <div className="flex items-center gap-3 border-b border-border px-4 pb-4 pt-1">
              <UserAvatar
                name={avatarName}
                src={realAvatarUrl}
                className="h-12 w-12 shrink-0"
                fallbackClassName="bg-primary/15 text-sm font-semibold text-primary"
              />
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-base font-semibold">{label}</DialogTitle>
                <p className="truncate text-xs text-muted-foreground">{realEmail}</p>
                {realProfile && (
                  <span
                    className={cn(
                      'mt-1.5 inline-block w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
                      VIEW_MODE_ACCENT[realViewMode]
                    )}
                  >
                    {roleBadgeLabel(realProfile)}
                  </span>
                )}
              </div>
            </div>

            <ul className="py-1">
              <SheetRow icon={Settings} label="Ajustes" onClick={() => go('/ajustes')} />
              {canMembers && (
                <>
                  <RowSeparator inset={52} />
                  <SheetRow
                    icon={Users}
                    label="Miembros"
                    onClick={() => go('/ajustes?tab=miembros')}
                  />
                </>
              )}
              <RowSeparator inset={52} />
              {/* En móvil no hay barra lateral, así que esta es la única
                  puerta a la ayuda: por eso está aquí y no solo allí. */}
              <SheetRow icon={HelpCircle} label="Ayuda" onClick={() => go('/ayuda')} />
              {isDev && <ViewAsSheetSection />}
            </ul>

            <div className="border-t border-border py-1">
              <SheetRow
                icon={LogOut}
                label="Cerrar sesión"
                destructive
                onClick={() => {
                  setMenuOpen(false);
                  setLogoutDialogOpen(true);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
        {logoutDialog}
      </>
    );
  }

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <AnimatePresence>
        {menuOpen && (
          <DropdownMenuPrimitive.Portal forceMount>
            <DropdownMenuPrimitive.Content asChild align="end" sideOffset={8} forceMount>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: menuHeight }}
                exit={{ opacity: 0, height: 0 }}
                transition={SPRINGS.smooth}
                className="z-50 w-72 overflow-hidden rounded-md shadow-xl md:w-56"
              >
                <div
                  ref={measureRef}
                  className="rounded-md border border-border bg-popover p-1 text-popover-foreground"
                >
                  <DropdownMenuLabel className="text-foreground">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground truncate">{realEmail}</p>
                      {realProfile && (
                        <span
                          className={cn(
                            'mt-1 inline-block w-fit rounded-full px-2 py-0.5 text-[11px] md:text-[10px] font-semibold uppercase tracking-wider',
                            VIEW_MODE_ACCENT[realViewMode]
                          )}
                        >
                          {roleBadgeLabel(realProfile)}
                        </span>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />

                  <DropdownMenuItem
                    onClick={() => router.push('/ajustes')}
                    className="text-foreground hover:bg-accent cursor-pointer"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Ajustes</span>
                  </DropdownMenuItem>
                  {(access.can('invitar_personal') || access.can('gestionar_roles')) && (
                    <DropdownMenuItem
                      onClick={() => router.push('/ajustes?tab=miembros')}
                      className="text-foreground hover:bg-accent cursor-pointer"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      <span>Miembros</span>
                    </DropdownMenuItem>
                  )}

                  {/* En móvil no hay barra lateral, así que esta es la única
                    puerta a la ayuda: por eso está aquí y no solo allí. */}
                  <DropdownMenuItem
                    onClick={() => router.push('/ayuda')}
                    className="text-foreground hover:bg-accent cursor-pointer"
                  >
                    <HelpCircle className="mr-2 h-4 w-4" />
                    <span>Ayuda</span>
                  </DropdownMenuItem>

                  {isDev && <ViewAsMenuSection />}

                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem
                    onClick={() => setLogoutDialogOpen(true)}
                    className="text-destructive hover:bg-destructive/10 focus:bg-destructive/10 cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar Sesión</span>
                  </DropdownMenuItem>
                </div>
              </motion.div>
            </DropdownMenuPrimitive.Content>
          </DropdownMenuPrimitive.Portal>
        )}
      </AnimatePresence>

      {logoutDialog}
    </DropdownMenu>
  );
}

// ─── Piezas de la hoja móvil ─────────────────────────────────

function SheetRow({
  icon: Icon,
  label,
  onClick,
  destructive = false,
  trailing,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px] outline-none transition-colors active:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
          destructive ? 'text-destructive' : 'text-foreground'
        )}
      >
        <Icon
          className={cn(
            'h-5 w-5 shrink-0',
            destructive ? 'text-destructive' : 'text-muted-foreground'
          )}
        />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {trailing}
      </button>
    </li>
  );
}

/**
 * «Ver como» en la hoja móvil: lo mismo que ViewAsMenuSection, pero con
 * filas de hoja en vez de items de desplegable (que solo funcionan dentro
 * de un DropdownMenu). Plegado con la extensión suave de la app.
 */
function ViewAsSheetSection() {
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
      <RowSeparator inset={52} />
      <SheetRow
        icon={Eye}
        label={`Ver como · ${activeLabel ?? ''}`}
        onClick={() => setOpen((v) => !v)}
        trailing={
          <motion.span
            initial={false}
            animate={{ rotate: open ? 0 : -90 }}
            transition={SPRINGS.snappy}
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.span>
        }
      />
      <Collapse open={open}>
        <ul className="bg-muted/30 py-1">
          <SheetRow
            icon={Crown}
            label="Mánager"
            onClick={exitToManager}
            trailing={!simulating ? <Check className="h-4 w-4 text-primary" /> : undefined}
          />
          {designers.map((d) => (
            <SheetRow
              key={d.id}
              icon={UserCog}
              label={d.displayName}
              onClick={() => enterDesignerView(d)}
              trailing={
                simulating && simulatedDesignerId === d.id ? (
                  <Check className="h-4 w-4 text-role-designer" />
                ) : undefined
              }
            />
          ))}
        </ul>
      </Collapse>
    </>
  );
}
