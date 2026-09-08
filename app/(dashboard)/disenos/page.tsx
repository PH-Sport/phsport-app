'use client';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { List, CalendarDays } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateDesignDialog } from '@/components/features/designs/dialogs/create-design-dialog';
import { CreateDesignButton } from '@/components/features/designs/dialogs/create-design-button';
import { EmptyState } from '@/components/ui/empty-state';
import { DashboardPage } from '@/components/ui/dashboard-page';
import { DesignsSkeleton } from '@/components/skeletons/designs-skeleton';
import { useDesigners } from '@/lib/hooks/use-designers';
import { useFormerDesigners } from '@/lib/hooks/use-former-designers';
import type { Design } from '@/lib/types/design';
import { toast } from 'sonner';
import { DesignDetailSheet } from '@/components/features/designs/design-detail-sheet';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useDesigns } from '@/lib/hooks/use-designs';
import { useDesignsFilters } from '@/lib/hooks/use-designs-filters';
import { useDesignsTable } from '@/lib/hooks/use-designs-table';
import { DesignsFilters } from '@/components/features/designs/designs-filters';
import { DesignsTable } from '@/components/features/designs/designs-table';
import { Tip } from '@/components/ui/tip';

// FullCalendar es pesado: solo se carga cuando se usa la vista calendario
const DesignCalendar = dynamic(
  () => import('@/components/features/designs/calendar/design-calendar'),
  { ssr: false, loading: () => <Skeleton className="h-[560px] w-full rounded-lg" /> }
);

type DesignsView = 'list' | 'calendar';

// Wrapper component para Suspense boundary requerido por useSearchParams
export default function DesignsPage() {
  return (
    <Suspense fallback={<DesignsSkeleton />}>
      <DesignsPageContent />
    </Suspense>
  );
}

function DesignsPageContent() {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDesign, setEditingDesign] = useState<Design | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Estado para el panel de detalles
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  // Estado para el diálogo de confirmación de eliminación
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [designToDelete, setDesignToDelete] = useState<Design | null>(null);

  const { designers } = useDesigners();
  const { formerDesigners } = useFormerDesigners();
  const filters = useDesignsFilters();
  const router = useRouter();

  // Leer query param ?open para abrir diseño automáticamente
  const searchParams = useSearchParams();
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId) {
      setSelectedDesignId(openId);
      setDetailSheetOpen(true);
    }
  }, [searchParams]);

  // Vista Lista/Calendario — ?view= manda; si no, la preferencia de Ajustes
  const [view, setView] = useState<DesignsView>('list');
  const viewInitialized = useRef(false);
  useEffect(() => {
    if (viewInitialized.current) return;
    viewInitialized.current = true;
    const param = searchParams.get('view');
    if (param === 'calendar' || param === 'list') {
      setView(param);
      return;
    }
    if (localStorage.getItem('defaultView') === 'calendar') {
      setView('calendar');
    }
  }, [searchParams]);

  const setViewAndUrl = (next: DesignsView) => {
    setView(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'list') {
      params.delete('view');
    } else {
      params.set('view', 'calendar');
    }
    const qs = params.toString();
    router.replace(`/disenos${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  // SWR Hook for fetching designs
  const { items, isLoading, error, mutate } = useDesigns({
    weekStart: filters.weekStartFilter,
    weekEnd: filters.weekEndFilter,
    statusFilter: filters.statusFilter,
    designerFilter: filters.designerFilter,
  });

  // Show toast when revalidation fails (even if we have cached data)
  useEffect(() => {
    if (error) {
      // id estable: SWR reintenta 2 veces y revalida al recuperar el foco, así
      // que sin él un solo corte de red apila un aviso por intento.
      toast.error('No se pudieron actualizar los datos. Revisa la conexión e inténtalo de nuevo.', {
        id: 'disenos-revalidacion',
      });
    }
  }, [error]);

  // Filtrar items localmente basado en searchQuery (usando debounced)
  const filteredItems = useMemo(() => {
    const query = filters.debouncedSearchQuery.toLowerCase();
    if (!query) return items;
    return items.filter((design) =>
      design.title.toLowerCase().includes(query) ||
      design.player.toLowerCase().includes(query) ||
      (design.match_home?.toLowerCase().includes(query) ?? false) ||
      (design.match_away?.toLowerCase().includes(query) ?? false)
    );
  }, [items, filters.debouncedSearchQuery]);

  const table = useDesignsTable(filteredItems);

  const handleEdit = (design: Design) => {
    setEditingDesign(design);
    setEditDialogOpen(true);
  };

  const handleDelete = (design: Design) => {
    setDesignToDelete(design);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!designToDelete) return;

    setDeletingId(designToDelete.id);
    try {
      const response = await fetch(`/api/designs/${designToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar diseño');
      }

      toast.success('Diseño eliminado exitosamente');
      setDeleteConfirmOpen(false);
      setDesignToDelete(null);
      mutate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar diseño');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditDialogClose = () => {
    setEditDialogOpen(false);
    setEditingDesign(null);
  };

  const handleOpenDetail = (designId: string) => {
    setSelectedDesignId(designId);
    setDetailSheetOpen(true);
  };

  // Error state se maneja fuera del PageTransition cuando no hay datos cacheados
  if (error && items.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="Error al cargar diseños"
          description={error.message}
          actionLabel="Reintentar"
          onAction={() => mutate()}
        />
      </div>
    );
  }

  // Only show skeleton on initial load (no cached data yet)
  const showSkeleton = isLoading && items.length === 0;
  const searchQueryActive = !!filters.debouncedSearchQuery;

  return (
    <DashboardPage
      title="Diseños"
      loading={showSkeleton}
      skeleton={<DesignsSkeleton />}
      actions={
        <>
          <Tabs value={view} onValueChange={(v) => setViewAndUrl(v as DesignsView)}>
            <TabsList>
              <TabsTrigger value="list">
                <List className="mr-1.5 h-4 w-4" />
                Lista
              </TabsTrigger>
              <TabsTrigger value="calendar">
                <CalendarDays className="mr-1.5 h-4 w-4" />
                Calendario
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {/* En móvil crear vive en el «+» de la tab bar inferior. */}
          <CreateDesignButton
            onDesignCreated={() => mutate()}
            activeWeekStart={filters.weekStartFilter}
            activeWeekEnd={filters.weekEndFilter}
            className="hidden md:inline-flex"
          />
        </>
      }
    >
      <DesignsFilters
        searchQuery={filters.searchQuery}
        onSearchQueryChange={filters.setSearchQuery}
        statusFilter={filters.statusFilter}
        onStatusFilterChange={filters.setStatusFilter}
        designerFilter={filters.designerFilter}
        onDesignerFilterChange={filters.setDesignerFilter}
        weekStartFilter={filters.weekStartFilter}
        onWeekStartChange={filters.setWeekStartFilter}
        weekEndFilter={filters.weekEndFilter}
        onWeekEndChange={filters.setWeekEndFilter}
        designers={designers}
        formerDesigners={formerDesigners}
        hasActiveFilters={filters.hasActiveFilters}
        onReset={filters.resetFilters}
      />

      {view === 'calendar' ? (
        <DesignCalendar
          items={filteredItems}
          onEventClick={(item) => handleOpenDetail(item.id)}
        />
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col gap-4">
          {/* Una lista vacía casi nunca significa que no exista: significa que
              cae fuera de la semana elegida. Es la confusión número uno de la
              app, así que el consejo se pinta justo aquí y no en un manual. */}
          <Tip tipId={searchQueryActive ? 'buscador-alcance' : 'rango-de-fechas'} />
          <EmptyState
            title={searchQueryActive ? 'No se encontraron resultados' : 'No hay diseños programados'}
            description={searchQueryActive ? 'Intenta con otros términos de búsqueda' : 'Crea tu primer diseño para comenzar'}
            actionLabel={searchQueryActive ? 'Limpiar búsqueda' : 'Crear Diseño'}
            onAction={() => {
              if (searchQueryActive) {
                filters.setSearchQuery('');
              } else {
                setEditingDesign(null);
                setEditDialogOpen(true);
              }
            }}
          />
        </div>
      ) : (
        <DesignsTable
          paginatedItems={table.paginatedItems}
          designers={designers}
          totalItems={table.totalItems}
          totalUnfilteredCount={items.length}
          searchQueryActive={searchQueryActive}
          itemsPerPage={table.itemsPerPage}
          currentPage={table.currentPage}
          totalPages={table.totalPages}
          startIndex={table.startIndex}
          endIndex={table.endIndex}
          sortColumn={table.sortColumn}
          sortDirection={table.sortDirection}
          onSort={table.handleSort}
          onItemsPerPageChange={(n) => {
            table.setItemsPerPage(n);
            table.setCurrentPage(1);
          }}
          onPageChange={table.setCurrentPage}
          onOpenDetail={handleOpenDetail}
          onEdit={handleEdit}
          onDelete={handleDelete}
          deletingId={deletingId}
        />
      )}

      <CreateDesignDialog
        open={editDialogOpen}
        onOpenChange={handleEditDialogClose}
        onDesignCreated={() => mutate()}
        design={editingDesign}
        activeWeekStart={filters.weekStartFilter}
        activeWeekEnd={filters.weekEndFilter}
      />

      <DesignDetailSheet
        designId={selectedDesignId}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onDesignUpdated={() => mutate()}
        onRequestDelete={handleDelete}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open);
          if (!open) setDesignToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Eliminar diseño"
        description={designToDelete ? `¿Estás seguro de que quieres eliminar "${designToDelete.title}"? Esta acción no se puede deshacer.` : ''}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deletingId !== null}
      />
    </DashboardPage>
  );
}
