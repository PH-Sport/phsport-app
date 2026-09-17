import { Surface } from '@/components/ui/surface';

/**
 * Subapartado de una ficha: rótulo eyebrow + descripción, placa debajo. Es el
 * mismo patrón que Ajustes usa para sus apartados; vive aquí porque las
 * pantallas de jugadores lo repiten tres veces.
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
