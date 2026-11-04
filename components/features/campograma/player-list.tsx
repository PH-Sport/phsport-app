'use client';

import { RowSeparator } from '@/components/ui/row';
import { Surface } from '@/components/ui/surface';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  clubLabel,
  POSITION_LINE,
  POSITION_SHORT,
  sortPlayers,
  yearLabel,
  type PlayerSortKey,
  type PortfolioPlayer,
} from '@/lib/utils/campograma';
import { LINE_TEXT } from './pitch';

export interface PlayerSort {
  key: PlayerSortKey;
  dir: 1 | -1;
}

const COLUMNS: { key: PlayerSortKey; label: string }[] = [
  { key: 'name', label: 'Jugador' },
  { key: 'year', label: 'Año' },
  { key: 'club', label: 'Club' },
  { key: 'position', label: 'Demarcación' },
];

function SortButton({
  column,
  sort,
  onSort,
}: {
  column: (typeof COLUMNS)[number];
  sort: PlayerSort;
  onSort: (sort: PlayerSort) => void;
}) {
  const active = sort.key === column.key;
  return (
    <button
      type="button"
      data-sort={column.key}
      onClick={() => onSort({ key: column.key, dir: active ? (sort.dir === 1 ? -1 : 1) : 1 })}
      className={cn(
        'rounded-md px-1.5 py-1 text-xs font-medium transition-colors hover:text-foreground',
        active ? 'text-foreground' : 'text-muted-foreground'
      )}
    >
      {column.label}
      {active && (sort.dir === 1 ? ' ↑' : ' ↓')}
    </button>
  );
}

function PositionChip({ player }: { player: PortfolioPlayer }) {
  return (
    <span
      className={cn(
        'rounded-full border border-current px-1.5 py-0.5 text-[10px] font-medium',
        LINE_TEXT[POSITION_LINE[player.position]]
      )}
    >
      {POSITION_SHORT[player.position]}
    </span>
  );
}

/** Cesión y movimiento pendiente no filtran (decisión de PH): quedan como anotación. */
function SituationChip({ player }: { player: PortfolioPlayer }) {
  if (player.situation === 'loaned') {
    return (
      <span className="inline-block max-w-full truncate rounded-full border border-current px-2 py-0.5 text-xs text-situation-loaned">
        Cesión{player.loanedTo && ` · ${player.loanedTo}`}
      </span>
    );
  }
  if (player.situation === 'pending') {
    return (
      <span className="inline-block rounded-full border border-current px-2 py-0.5 text-xs text-situation-pending">
        Pte. mov.
      </span>
    );
  }
  return null;
}

interface PlayerListProps {
  players: PortfolioPlayer[];
  sort: PlayerSort;
  onSort: (sort: PlayerSort) => void;
  onOpenPlayer: (id: string) => void;
}

export function PlayerList({ players, sort, onSort, onOpenPlayer }: PlayerListProps) {
  const sorted = sortPlayers(players, sort.key, sort.dir);

  return (
    <Surface variant="grouped" padded={false} className="overflow-hidden">
      {/* Móvil y iPad: filas de dos líneas. Una tabla ancha obligaría a desplazar de lado. */}
      <div className="lg:hidden">
        <div className="flex flex-wrap gap-0.5 border-b border-border px-2 py-1.5">
          {COLUMNS.map((column) => (
            <SortButton key={column.key} column={column} sort={sort} onSort={onSort} />
          ))}
        </div>
        <ul>
          {sorted.map((p, i) => (
            <li key={p.id}>
              {i > 0 && <RowSeparator />}
              <button
                type="button"
                data-list-row
                onClick={() => onOpenPlayer(p.id)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left transition-colors hover:bg-accent"
              >
                <span className="truncate text-sm font-medium">{p.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {p.birthYear === null ? '' : yearLabel(p.birthYear)}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cn('truncate text-xs text-muted-foreground', !p.ownerClub && 'italic')}>
                    {clubLabel(p.ownerClub)}
                  </span>
                  <SituationChip player={p} />
                </span>
                <span className="justify-self-end">
                  <PositionChip player={p} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHead key={column.key} aria-sort={sort.key === column.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  {/* -ml: el texto del botón alinea con el de la celda, no su caja. */}
                  <div className="-ml-1.5">
                    <SortButton column={column} sort={sort} onSort={onSort} />
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-xs font-medium text-muted-foreground">Situación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((p) => (
              <TableRow key={p.id} data-table-row onClick={() => onOpenPlayer(p.id)} className="cursor-pointer">
                <TableCell className="font-medium">
                  {/* El botón es para el teclado; el clic lo recoge la fila entera. */}
                  <button type="button" className="text-left">
                    {p.name}
                  </button>
                </TableCell>
                <TableCell className={cn('tabular-nums text-muted-foreground', p.birthYear === null && 'italic')}>
                  {yearLabel(p.birthYear)}
                </TableCell>
                <TableCell className={cn(!p.ownerClub && 'italic text-muted-foreground')}>
                  {clubLabel(p.ownerClub)}
                </TableCell>
                <TableCell>
                  <PositionChip player={p} />
                </TableCell>
                <TableCell>
                  <SituationChip player={p} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Surface>
  );
}
