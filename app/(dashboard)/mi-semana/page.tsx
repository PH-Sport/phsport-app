'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Undo2, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapse } from '@/components/ui/collapse';
import { Button } from '@/components/ui/button';
import { DashboardPage } from '@/components/ui/dashboard-page';
import { MyWeekSkeleton } from '@/components/skeletons/my-week-skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Hint } from '@/components/ui/tooltip';
import { Surface } from '@/components/ui/surface';
import { Tip } from '@/components/ui/tip';
import { RowSeparator } from '@/components/ui/row';
import { SPRINGS, STAGGER, TWEENS } from '@/components/ui/animations';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/auth-context';
import { useConfirm } from '@/lib/hooks/use-confirm';
import { useMyWeek } from '@/lib/hooks/use-my-week';
import { useMyWeekData } from '@/lib/hooks/use-my-week-data';
import type { Design, DesignStatus } from '@/lib/types/design';
import { DesignDetailSheet } from '@/components/features/designs/design-detail-sheet';
import { UrgencyDot, getUrgency } from '@/components/ui/urgency-dot';

const rise = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: SPRINGS.gentle },
};

export default function MyWeekPage() {
  const router = useRouter();
  const { profile, status } = useAuth();
  const { items, isLoading, mutate } = useMyWeek();
  const { inProgress, deliveredGroups, deliveredCount } = useMyWeekData(items);

  const [updating, setUpdating] = useState<string | null>(null);
  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm();

  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Semanas de entregados abiertas (la más reciente, por defecto).
  const [openWeeks, setOpenWeeks] = useState<string[]>([]);
  useEffect(() => {
    if (deliveredGroups.length > 0) {
      setOpenWeeks((prev) => (prev.length === 0 ? [deliveredGroups[0].key] : prev));
    }
  }, [deliveredGroups]);

  // Redireccionar admins a /equipo
  useEffect(() => {
    if (status === 'AUTHENTICATED' && profile && profile.role === 'ADMIN') {
      router.replace('/equipo');
    }
  }, [status, profile, router]);

  const handleStatusChange = async (design: Design, newStatus: DesignStatus) => {
    const toDelivered = newStatus === 'DELIVERED';
    const confirmed = await confirm({
      title: toDelivered ? '¿Marcar como entregada?' : '¿Volver a pendiente?',
      description: toDelivered
        ? `«${design.title}» pasará a entregadas.`
        : `«${design.title}» dejará de contar como entregada y volverá a tu cola.`,
      confirmText: toDelivered ? 'Sí, entregar' : 'Volver atrás',
      cancelText: 'Cancelar',
      variant: toDelivered ? 'info' : 'warning',
    });
    if (!confirmed) return;

    setUpdating(design.id);
    try {
      const response = await fetch(`/api/designs/${design.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error('Error al actualizar estado');
      toast.success(newStatus === 'DELIVERED' ? 'Entregada' : 'Devuelta a pendientes');
      mutate();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Error al actualizar estado');
    } finally {
      setUpdating(null);
    }
  };

  const openDetail = (id: string) => {
    setSelectedDesignId(id);
    setDetailOpen(true);
  };

  const hasAnyItems = inProgress.length > 0 || deliveredCount > 0;
  const showSkeleton = (isLoading && items.length === 0) || status === 'INITIALIZING';

  return (
    <DashboardPage
      title="Mi semana"
      loading={showSkeleton}
      skeleton={<MyWeekSkeleton />}
    >
      {!hasAnyItems ? (
        <div className="flex flex-col gap-4">
          {/* «Nada asignado» y «asignado más allá del horizonte de esta vista»
              se ven exactamente igual. El consejo distingue los dos casos. */}
          <Tip tipId="rango-de-fechas" />
          <Card>
            <CardContent className="flex h-64 items-center justify-center">
              <div className="space-y-3 text-center">
                <p className="font-medium text-foreground">Semana despejada</p>
                <p className="text-sm text-muted-foreground">
                  Cuando te asignen trabajo, aparecerá aquí.
                </p>
                <Button asChild variant="outline">
                  <Link href="/disenos">Ver el backlog del equipo</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: STAGGER } } }}
          className="space-y-4"
        >
          {/* Pendientes */}
          <motion.div variants={rise}>
            {/* Mismo tratamiento que Entregadas y que el resto de listas de
                diseños: filas que se tocan → caja tonal con hairlines. */}
            <Surface as="section" variant="grouped">
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-base font-semibold">Pendientes</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 font-mono tabular text-[11px] text-muted-foreground">
                  {inProgress.length}
                </span>
              </div>
              {inProgress.length === 0 ? (
                <p className="py-md text-sm text-muted-foreground">Nada pendiente.</p>
              ) : (
                <ul className="-mx-2">
                  <AnimatePresence initial={false}>
                    {inProgress.map((d, i) => {
                      const urgency = getUrgency(d.deadline_at, false);
                      const overdue = urgency === 'overdue';
                      const short = format(new Date(d.deadline_at), "d MMM · HH:mm", { locale: es });
                      const busy = updating === d.id;
                      return (
                        <motion.li
                          key={d.id}
                          layout
                          exit={{ opacity: 0, x: 24, transition: TWEENS.base }}
                          transition={SPRINGS.smooth}
                        >
                          <div className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/40">
                            {/* UrgencyDot devuelve null cuando la entrega no corre
                                prisa. En movil se reserva su hueco igualmente, o el
                                texto de esas filas arrancaria 20px a la izquierda del
                                resto y el separador no casaria con ninguna. En md+ no
                                se reserva: no hay separadores que alinear y el hueco
                                cambiaria el escritorio. */}
                            {urgency ? (
                              <UrgencyDot level={urgency} />
                            ) : (
                              <span aria-hidden className="h-2 w-2 shrink-0 md:hidden" />
                            )}
                            <button
                              type="button"
                              onClick={() => openDetail(d.id)}
                              className="min-w-0 flex-1 text-left outline-none"
                            >
                              <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                                {d.title}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{d.player}</p>
                            </button>
                            <span
                              className={cn(
                                'shrink-0 font-mono tabular text-xs',
                                urgency === 'h24' || overdue
                                  ? 'font-semibold text-destructive'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {overdue ? `Atrasada · ${short}` : short}
                            </span>
                            <Hint label="Marcar como entregada">
                            <button
                              type="button"
                              onClick={() => handleStatusChange(d, 'DELIVERED')}
                              disabled={busy}
                              className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3.5 text-xs font-medium text-muted-foreground opacity-100 transition-all hover:border-status-success/40 hover:bg-status-success/10 hover:text-status-success focus-visible:opacity-100 disabled:opacity-50 md:h-8 md:px-2.5 md:opacity-0 md:group-hover:opacity-100"
                            >
                              {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              Entregar
                            </button>
                            </Hint>
                          </div>
                          {/* 28px = px-2 (8) + punto (8) + gap-3 (12) */}
                          {i < inProgress.length - 1 && <RowSeparator inset={28} />}
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </Surface>
          </motion.div>

          {/* Entregadas, por semana */}
          {deliveredCount > 0 && (
            <motion.div variants={rise}>
              {/* Con padding: la cabecera "Entregadas" vive DENTRO del bloque, y sin
                  el vive pegada a la esquina redondeada. En md+ da p-lg igual que
                  antes, asi que el escritorio no se entera. */}
              <Surface as="section">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold">Entregadas</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-mono tabular text-[11px] text-muted-foreground">
                    {deliveredCount}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {deliveredGroups.map((w) => {
                    const open = openWeeks.includes(w.key);
                    return (
                      <div key={w.key} className="-mx-2">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenWeeks((ws) =>
                              open ? ws.filter((x) => x !== w.key) : [...ws, w.key]
                            )
                          }
                          className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/40 md:min-h-0"
                        >
                          <motion.span
                            initial={false}
                            animate={{ rotate: open ? 0 : -90 }}
                            transition={SPRINGS.snappy}
                          >
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          </motion.span>
                          <span className="flex-1 text-eyebrow text-muted-foreground">
                            {w.label}
                          </span>
                          {/* Con un solo grupo, este numero es el mismo que el badge
                              de "Entregadas" que tiene justo encima. Solo informa
                              cuando hay varias semanas que comparar. */}
                          {deliveredGroups.length > 1 && (
                            <span className="font-mono tabular text-xs text-muted-foreground">
                              {w.items.length}
                            </span>
                          )}
                        </button>
                        <Collapse open={open}>
                          <ul>
                            {w.items.map((d) => {
                              const busy = updating === d.id;
                              const short = format(new Date(d.deadline_at), "d MMM", { locale: es });
                              return (
                                <motion.li
                                  key={d.id}
                                  layout
                                  className="group flex items-center gap-3 rounded-xl py-2 pl-9 pr-2 transition-colors hover:bg-muted/40"
                                >
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-success" />
                                  <button
                                    type="button"
                                    onClick={() => openDetail(d.id)}
                                    className="min-w-0 flex-1 truncate text-left text-sm text-muted-foreground line-through outline-none"
                                  >
                                    {d.title}
                                  </button>
                                  <span className="shrink-0 font-mono tabular text-xs text-muted-foreground">
                                    {short}
                                  </span>
                                  <Hint label="Volver a pendiente">
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(d, 'BACKLOG')}
                                    disabled={busy}
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-100 transition-all hover:bg-muted hover:text-foreground focus-visible:opacity-100 disabled:opacity-50 md:h-7 md:w-7 md:opacity-0 md:group-hover:opacity-100"
                                  >
                                    {busy ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Undo2 className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                  </Hint>
                                </motion.li>
                              );
                            })}
                          </ul>
                        </Collapse>
                      </div>
                    );
                  })}
                </div>
              </Surface>
            </motion.div>
          )}
        </motion.div>
      )}

      {options && (
        <ConfirmDialog
          open={isOpen}
          onOpenChange={handleCancel}
          onConfirm={handleConfirm}
          title={options.title}
          description={options.description}
          confirmLabel={options.confirmText || 'Confirmar'}
          cancelLabel={options.cancelText || 'Cancelar'}
          variant={options.variant || 'warning'}
        />
      )}

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
