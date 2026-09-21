'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { DashboardPage } from '@/components/ui/dashboard-page';
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { CreateDesignButton } from '@/components/features/designs/dialogs/create-design-button';
import { useAuth } from '@/lib/auth/auth-context';
import { viewModeFor } from '@/lib/utils/access';
import { DesignerDashboard } from '@/components/features/dashboard/designer-dashboard';
import { AdminDashboard } from '@/components/features/dashboard/admin-dashboard';
import { DesignDetailSheet } from '@/components/features/designs/design-detail-sheet';
import { useDashboard } from '@/lib/hooks/use-dashboard';
import { useDesigners } from '@/lib/hooks/use-designers';
import { useUpcomingWork } from '@/lib/hooks/use-upcoming-work';
import { upcomingLabel } from '@/lib/utils/upcoming-work';
import { PulseDot } from '@/components/ui/pulse-dot';
import {
  fillGreeting,
  getDailyTemplate,
  pickRotatingTemplate,
  GREETING_MAX_CHARS_MOBILE,
} from '@/lib/utils/greeting';
import { useIsMobile } from '@/lib/hooks/use-is-mobile';

// Aplica la rotación del saludo ANTES del primer pintado en cliente (sin flash,
// también en la vuelta en caliente que se salta el skeleton). En server cae a
// useEffect (no-op) para no avisar de useLayoutEffect durante el SSR.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Última variante mostrada, por pestaña: sobrevive a refresco y a navegar-y-volver.
const GREETING_STORAGE_KEY = 'phsport:greeting:last';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { items, isLoading, mutate, error } = useDashboard();
  // La lista de diseñadores la usan los dos dashboards, pero solo se montan
  // cuando el esqueleto se ha ido: pedida desde aquí sale a la vez que los
  // diseños en vez de después (medido: arrancaba medio segundo tarde). SWR la
  // comparte por clave, así que el dashboard la encuentra ya cargada.
  useDesigners();
  const [assigning, setAssigning] = useState(false);

  // Detalle de diseño al tocar una fila del dashboard (mismo patrón que Equipo).
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const openDetail = (id: string) => {
    setSelectedDesignId(id);
    setDetailOpen(true);
  };

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const dateRangeLabel = `${format(weekStart, 'd MMM', { locale: es })} – ${format(weekEnd, 'd MMM', { locale: es })}`;

  // Esta pantalla solo mira la semana en curso, así que lo asignado para más
  // adelante no asomaría por ningún lado. La coletilla lo dice de pasada, sin
  // añadir nada nuevo a la pantalla: si no hay cola, el rótulo es el de siempre.
  const upcoming = upcomingLabel(useUpcomingWork());


  // Nombre corto (alias || nombre) ya resuelto por la BD; cae al email si no hay perfil aún.
  const firstName = profile?.display_name || (user?.email ? user.email.split('@')[0] : '');
  const isMobile = useIsMobile();

  // Seed determinista (server === cliente) para no romper la hidratación...
  const [template, setTemplate] = useState<string>(getDailyTemplate);

  // En móvil el título comparte franja con la campana y el avatar, así que la
  // rotación descarta los saludos que no caben. Va por ref, no por dependencias:
  // el efecto tiene que correr UNA vez por montaje. Si dependiera de estos
  // valores, el saludo volvería a cambiar cuando el perfil termina de resolver o
  // cuando se gira el móvil, que es justo lo que el efecto evita.
  const fitRef = useRef({ name: firstName, isMobile });
  fitRef.current = { name: firstName, isMobile };

  // ...y al montar en cliente rotamos a otra variante de la franja, evitando la
  // última mostrada. Se repite en cada montaje → cubre refresco y navegar-y-volver.
  useIsomorphicLayoutEffect(() => {
    let last: string | null = null;
    try {
      last = sessionStorage.getItem(GREETING_STORAGE_KEY);
    } catch {
      /* sessionStorage no disponible (incógnito estricto, etc.): rotamos igual */
    }
    const { name, isMobile: enMovil } = fitRef.current;
    const next = pickRotatingTemplate(
      last,
      new Date(),
      Math.random,
      // Sin nombre resuelto todavía medimos contra uno de largo corriente: es
      // preferible pasarse de prudente a elegir un saludo que luego no quepa.
      enMovil ? { name: name || 'Nombre', maxChars: GREETING_MAX_CHARS_MOBILE } : undefined
    );
    setTemplate(next);
    try {
      sessionStorage.setItem(GREETING_STORAGE_KEY, next);
    } catch {
      /* sin memoria entre cargas, pero la rotación sigue funcionando */
    }
  }, []);

  // El nombre se rellena de forma reactiva (auth resuelve después): no re-rola.
  const title = fillGreeting(template, firstName);

  const handleAssign = async () => {
    setAssigning(true);
    try {
      const response = await fetch('/api/designs/assign', {
        method: 'POST',
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error al repartir diseños');
      }

      const result = await response.json();
      toast.success(result.message || 'Diseños repartidos exitosamente');
      mutate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al repartir diseños');
    } finally {
      setAssigning(false);
    }
  };

  const showSkeleton = isLoading && items.length === 0;
  // Sin esto, un fetch caído pintaría un dashboard vacío "sano" (fallo silencioso)
  const showError = Boolean(error) && items.length === 0 && !isLoading;

  return (
    <DashboardPage
      title={title}
      subtitle={
        upcoming ? (
          <>
            Semana del {dateRangeLabel}
            {/* La frase entera no cabe en móvil y partirla dejaba una palabra
                suelta colgando, así que ahí va sola la señal: el mismo punto con
                haz que la campana usa para «tienes algo sin leer». Avisa de que
                hay trabajo detrás, no de cuánto — el detalle queda para el lector
                de pantalla y para el escritorio, donde la frase sí cabe. */}
            <PulseDot label={upcoming} className="ml-2 md:hidden" />
            <span className="hidden md:inline"> · {upcoming}</span>
          </>
        ) : (
          `Semana del ${dateRangeLabel}`
        )
      }
      // En móvil crear vive en el «+» de la tab bar inferior; este botón es de escritorio.
      actions={
        <CreateDesignButton
          onDesignCreated={() => mutate()}
          variant="outline"
          className="hidden md:inline-flex"
        />
      }
      loading={showSkeleton}
      skeleton={<DashboardSkeleton variant={viewModeFor(profile) === 'manager' ? 'admin' : 'designer'} />}
    >
      {showError ? (
        <Card>
          <CardContent className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-7 w-7 text-destructive" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">No se pudo cargar el dashboard</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Comprueba tu conexión e inténtalo de nuevo.
                </p>
              </div>
              <Button variant="outline" onClick={() => mutate()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : viewModeFor(profile) === 'manager' ? (
        <AdminDashboard
          items={items}
          onAssign={handleAssign}
          assigning={assigning}
          onDesignClick={openDetail}
        />
      ) : user ? (
        <DesignerDashboard items={items} userId={user.id} onDesignClick={openDetail} />
      ) : null}

      <DesignDetailSheet
        designId={selectedDesignId}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setTimeout(() => setSelectedDesignId(null), 300);
        }}
        onDesignUpdated={() => mutate()}
      />
    </DashboardPage>
  );
}
