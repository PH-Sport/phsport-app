import { Surface } from '@/components/ui/surface';

/**
 * Subapartado (concepto D): rótulo eyebrow + descripción, placa debajo. Lo
 * usan Ajustes y las pantallas de Jugadores; antes cada uno tenía su copia.
 */
export function Section({
  label,
  hint,
  padded = true,
  children,
}: {
  label: string;
  hint?: string;
  padded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="text-eyebrow text-primary">{label}</p>
      {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      <Surface variant="grouped" padded={padded} className="mt-3 overflow-hidden">
        {children}
      </Surface>
    </section>
  );
}
