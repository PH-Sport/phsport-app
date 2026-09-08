import { Skeleton } from '@/components/ui/skeleton';
import { Surface } from '@/components/ui/surface';

/**
 * Skeleton de /ayuda (la cabecera la pinta DashboardPage, así que no va aquí).
 * Espeja la forma real: buscador arriba y tres bloques de sección con sus
 * consejos, cada uno un título corto y dos líneas de cuerpo.
 */
export function HelpSkeleton() {
  return (
    <div className="max-w-2xl space-y-xl pb-xl">
      <Skeleton className="h-11 w-full rounded-md md:h-10" />

      {[3, 4, 2].map((tips, section) => (
        <section key={section}>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-1.5 h-4 w-56" />
          <Surface className="mt-3">
            <div className="space-y-5 py-1">
              {[...Array(tips)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-4/5" />
                </div>
              ))}
            </div>
          </Surface>
        </section>
      ))}
    </div>
  );
}
