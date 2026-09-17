'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WeekNav } from '@/components/ui/week-nav';
import { DashboardPage } from '@/components/ui/dashboard-page';
import { Eyebrow } from '@/components/ui/eyebrow';
import { DesignerDetailSkeleton } from '@/components/skeletons/designer-detail-skeleton';
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { homeFor, viewModeFor } from '@/lib/utils/access';
import { useTeamData } from '@/lib/hooks/use-team-data';
import { sumWeight } from '@/lib/services/designs/weekly-load';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/user-avatar';
import { DesignDetailSheet } from '@/components/features/designs/design-detail-sheet';
import { STATUS_LABELS, getDesignContext } from '@/lib/types/design';
import type { Design } from '@/lib/types/design';

function parseWeekParam(value: string | null): Date {
  if (!value) return new Date();
  const parsed = new Date(`${value}T00:00:00`);
  return isValid(parsed) ? parsed : new Date();
}

function DesignerDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { profile, status } = useAuth();
  const authLoading = status === 'INITIALIZING';

  const [selectedWeek, setSelectedWeek] = useState(() =>
    parseWeekParam(searchParams.get('semana'))
  );
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const weekStart = useMemo(() => startOfWeek(selectedWeek, { weekStartsOn: 1 }), [selectedWeek]);
  const weekEnd = useMemo(() => endOfWeek(selectedWeek, { weekStartsOn: 1 }), [selectedWeek]);

  const { designers, isLoading, mutate } = useTeamData(weekStart, weekEnd);
  const designer = designers.find((d) => d.id === id) ?? null;

  // Solo admins
  useEffect(() => {
    if (!authLoading && profile && viewModeFor(profile) !== 'manager') {
      router.replace(homeFor(viewModeFor(profile)));
    }
  }, [authLoading, profile, router]);

  const changeWeek = (next: Date) => {
    setSelectedWeek(next);
    const param = format(startOfWeek(next, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    router.replace(`/equipo/${id}?semana=${param}`, { scroll: false });
  };

  const handleSelectDesign = (designId: string) => {
    setSelectedDesignId(designId);
    setDetailSheetOpen(true);
  };

  if (!authLoading && profile && viewModeFor(profile) !== 'manager') {
    return null;
  }

  const weekLabel = `${format(weekStart, "d 'de' MMM", { locale: es })} - ${format(weekEnd, "d 'de' MMM", { locale: es })}`;
  const isCurrentWeek =
    format(weekStart, 'yyyy-MM-dd') ===
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const designs = designer?.designs ?? [];
  const backlog = designs.filter((d) => d.status === 'BACKLOG');
  const delivered = designs.filter((d) => d.status === 'DELIVERED');
  const loadWeight = sumWeight(backlog);
  const capacity = designer?.weekly_capacity ?? 10;
  const loadPct = capacity > 0 ? Math.round((loadWeight / capacity) * 100) : 0;

  const showSkeleton = (isLoading && designers.length === 0) || authLoading;

  const renderDesignItem = (design: Design) => (
    <Card
      key={design.id}
      density="compact"
      className="cursor-pointer rounded-surface border-0 hover:border-primary/40 md:rounded-lg md:border md:border-border md:shadow-raised"
      onClick={() => handleSelectDesign(design.id)}
    >
      <CardContent className="pt-md">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-medium">{design.title}</h4>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              {design.player}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{getDesignContext(design)}</p>
          </div>
          {design.folder_url && (
            <Button variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8" asChild>
              <a
                href={design.folder_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir carpeta en Drive"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Badge status={design.status} className="text-xs">
            {STATUS_LABELS[design.status]}
          </Badge>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(design.deadline_at), 'dd MMM HH:mm', { locale: es })}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  const renderSection = (title: string, items: Design[], titleClass: string) => {
    if (items.length === 0) return null;
    return (
      <section className="space-y-2">
        <h3 className={`text-sm font-medium ${titleClass}`}>
          {title} ({items.length})
        </h3>
        <div className="space-y-2">{items.map(renderDesignItem)}</div>
      </section>
    );
  };

  return (
    <DashboardPage
      title={
        <span className="flex items-center gap-3">
          <UserAvatar
            name={designer?.full_name}
            src={designer?.avatar_url}
            className="h-10 w-10"
            fallbackClassName="bg-primary/10 text-primary font-semibold"
          />
          {designer?.display_name ?? 'Diseñador'}
        </span>
      }
      subtitle={`Diseños asignados · ${weekLabel}`}
      maxWidth="4xl"
      loading={showSkeleton}
      skeleton={<DesignerDetailSkeleton />}
      actions={
        <>
          <Button variant="ghost" asChild>
            <Link href="/equipo">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Equipo
            </Link>
          </Button>
          <WeekNav
            label={weekLabel}
            isCurrent={isCurrentWeek}
            onPrev={() => changeWeek(subWeeks(selectedWeek, 1))}
            onNext={() => changeWeek(addWeeks(selectedWeek, 1))}
            onCurrent={() => changeWeek(new Date())}
          />
        </>
      }
    >
      {!designer ? (
        <Card>
          <CardContent className="flex h-64 items-center justify-center">
            <div className="space-y-3 text-center">
              <p className="text-muted-foreground">
                No se encontró este diseñador. Puede que ya no forme parte del equipo.
              </p>
              <Button asChild variant="outline">
                <Link href="/equipo">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al equipo
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-xl">
          {/* Resumen de la semana */}
          <div className="flex flex-wrap gap-xl">
            <div>
              <Eyebrow>Asignados</Eyebrow>
              <p className="font-mono tabular text-3xl font-semibold leading-tight text-foreground">
                {designs.length}
              </p>
            </div>
            <div>
              <Eyebrow>Pendientes</Eyebrow>
              <p className="font-mono tabular text-3xl font-semibold leading-tight text-foreground">
                {backlog.length}
              </p>
            </div>
            <div>
              <Eyebrow>Entregados</Eyebrow>
              <p className="font-mono tabular text-3xl font-semibold leading-tight text-status-success">
                {delivered.length}
              </p>
            </div>
            <div>
              <Eyebrow>Carga</Eyebrow>
              <p
                className={cn(
                  'font-mono tabular text-3xl font-semibold leading-tight',
                  loadPct > 100 ? 'text-status-warning' : 'text-foreground'
                )}
              >
                {loadPct}%
              </p>
              <p className="font-mono tabular text-xs text-muted-foreground">
                {loadWeight}/{capacity}
              </p>
            </div>
          </div>

          {designs.length === 0 ? (
            <Card>
              <CardContent className="flex h-40 items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Sin diseños asignados esta semana.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-lg">
              {renderSection('Pendientes', backlog, 'text-muted-foreground')}
              {renderSection('Entregados', delivered, 'text-status-success')}
            </div>
          )}
        </div>
      )}

      <DesignDetailSheet
        designId={selectedDesignId}
        open={detailSheetOpen}
        onOpenChange={(open) => {
          setDetailSheetOpen(open);
          if (!open) {
            setTimeout(() => setSelectedDesignId(null), 300);
          }
        }}
        onDesignUpdated={() => mutate()}
      />
    </DashboardPage>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DesignerDetailPage />
    </Suspense>
  );
}
