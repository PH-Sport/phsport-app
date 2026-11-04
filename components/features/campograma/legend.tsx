const ITEMS = [
  { label: 'Portero', dot: 'bg-position-por' },
  { label: 'Defensa', dot: 'bg-position-def' },
  { label: 'Medio', dot: 'bg-position-med' },
  { label: 'Ataque', dot: 'bg-position-ata' },
  { label: 'En cesión', dot: 'bg-situation-loaned' },
  { label: 'Pendiente de movimiento', dot: 'bg-situation-pending' },
];

export function Legend() {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {ITEMS.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <i aria-hidden className={`h-2 w-2 rounded-full ${item.dot}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
