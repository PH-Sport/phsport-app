'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/lib/hooks/use-is-mobile';
import { cn } from '@/lib/utils';
import {
  clubLabel,
  matchesSearch,
  POSITION_LABEL,
  POSITION_LINE,
  POSITION_SHORT,
  signalPlayers,
  SIGNALS,
  splitCoach,
  yearLabel,
  type PortfolioCategory,
  type PortfolioPlayer,
  type Position,
  type Signal,
} from '@/lib/utils/campograma';
import { LINE_TEXT } from './pitch';

export type ListView = { kind: 'position'; position: Position } | { kind: 'signal'; signal: Signal };

export type DetailView =
  | ListView
  | { kind: 'player'; playerId: string; back: ListView | null }
  | { kind: 'coach'; categoryId: string };

const SITUATION_DOT = {
  loaned: { className: 'bg-situation-loaned', title: 'En cesión' },
  pending: { className: 'bg-situation-pending', title: 'Pendiente de movimiento' },
};

function listTitle(view: ListView): string {
  return view.kind === 'position' ? POSITION_LABEL[view.position] : SIGNALS[view.signal].title;
}

function Header({
  eyebrow,
  title,
  onBack,
  backLabel,
}: {
  eyebrow: string;
  title: string;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    // pr-10: la X del panel lateral cae encima de esta esquina.
    <div className="flex items-start gap-1 pr-10">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          title={backLabel}
          className="-ml-2 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0">
        <p className="text-eyebrow text-muted-foreground">{eyebrow}</p>
        <DialogTitle className="text-xl font-semibold tracking-tight">{title}</DialogTitle>
      </div>
    </div>
  );
}

function PlayerRow({ player, onOpen }: { player: PortfolioPlayer; onOpen: () => void }) {
  const dot = player.situation ? SITUATION_DOT[player.situation] : null;
  return (
    <li>
      {/* Una sola línea: con la hoja al 60 % de alto caben ocho filas sin desplazar. */}
      <button
        type="button"
        data-player
        onClick={onOpen}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,36%)_0.5rem] items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-accent"
      >
        <span
          aria-hidden
          className={cn('h-4 w-[3px] rounded-full bg-current', LINE_TEXT[POSITION_LINE[player.position]])}
        />
        <span className="truncate font-medium">{player.name}</span>
        <span className={cn('text-xs tabular-nums text-muted-foreground', player.birthYear === null && 'italic')}>
          {yearLabel(player.birthYear)}
        </span>
        <span className={cn('truncate text-xs text-muted-foreground', !player.ownerClub && 'italic')}>
          {clubLabel(player.ownerClub)}
        </span>
        <span
          title={dot?.title}
          className={cn('h-2 w-2 rounded-full', dot?.className)}
        />
      </button>
    </li>
  );
}

function PlayerList({
  eyebrow,
  title,
  shown,
  total,
  emptyText,
  onOpenPlayer,
}: {
  eyebrow: string;
  title: string;
  shown: PortfolioPlayer[];
  total: number;
  emptyText: string;
  onOpenPlayer: (id: string) => void;
}) {
  return (
    <>
      <Header eyebrow={eyebrow} title={title} />
      <p className="mt-1 text-sm text-muted-foreground">
        <b className="font-semibold text-foreground">{shown.length}</b> jugador{shown.length === 1 ? '' : 'es'}
        {shown.length !== total && ` de ${total}`}
      </p>
      {shown.length > 0 ? (
        <ul className="-mx-2 mt-3">
          {shown.map((p) => (
            <PlayerRow key={p.id} player={p} onOpen={() => onOpenPlayer(p.id)} />
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-center text-sm text-muted-foreground">{emptyText}</p>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-eyebrow text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </>
  );
}

const Unconfirmed = () => <span className="italic text-muted-foreground">Sin confirmar</span>;

function PlayerCard({
  player,
  categoryName,
  back,
  onBack,
}: {
  player: PortfolioPlayer;
  categoryName: string;
  back: ListView | null;
  onBack: () => void;
}) {
  const backLabel = back ? `Volver a ${listTitle(back)}` : undefined;
  return (
    <>
      <Header
        eyebrow={categoryName}
        title={player.name}
        onBack={back ? onBack : undefined}
        backLabel={backLabel}
      />
      {player.photoUrl && (
        // <img> y no next/image: la foto puede venir de cualquier sitio y next/image
        // solo admite los dominios que tenga apuntados.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={player.photoUrl} alt="" className="mt-4 h-24 w-24 rounded-full object-cover" />
      )}
      <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2.5">
        <Field label="Demarcación">
          <span
            className={cn(
              'mr-1.5 rounded-full border border-current px-1.5 py-0.5 text-[10px] font-medium',
              LINE_TEXT[POSITION_LINE[player.position]]
            )}
          >
            {POSITION_SHORT[player.position]}
          </span>
          {POSITION_LABEL[player.position]}
        </Field>
        <Field label="Año">
          {player.birthYear === null ? <Unconfirmed /> : <span className="tabular-nums">{player.birthYear}</span>}
        </Field>
        <Field label="Club">{player.ownerClub ?? <Unconfirmed />}</Field>
        <Field label="Categoría">{categoryName}</Field>
      </dl>
      {player.situation === 'loaned' && (
        <p className="mt-4 border-t border-border pt-4 text-sm">
          Cedido{player.loanedTo && (
            <>
              {' en el '}
              <b className="font-semibold">{player.loanedTo}</b>
            </>
          )}
          .
        </p>
      )}
      {player.situation === 'pending' && (
        <p className="mt-4 border-t border-border pt-4 text-sm">Pendiente de movimiento.</p>
      )}
    </>
  );
}

function CoachCard({ category }: { category: PortfolioCategory }) {
  const { name, team } = splitCoach(category.coach ?? '');
  return (
    <>
      <Header eyebrow="Cuerpo técnico" title={name} />
      <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2.5">
        <Field label="Rol">Entrenador</Field>
        {team && <Field label="Equipo">{team}</Field>}
        <Field label="Categoría">{category.name}</Field>
      </dl>
    </>
  );
}

interface DetailPanelProps {
  view: DetailView | null;
  onChange: (view: DetailView | null) => void;
  /** Toda la cartera: una ficha puede abrirse desde cualquier categoría. */
  players: PortfolioPlayer[];
  categories: PortfolioCategory[];
  category: PortfolioCategory | undefined;
  query: string;
}

/**
 * El detalle: hoja inferior en móvil y panel lateral en escritorio, con el mismo
 * contenido. Las dos piezas son diálogos de Radix, así que `DialogTitle` vale en
 * las dos.
 */
export function DetailPanel({ view, onChange, players, categories, category, query }: DetailPanelProps) {
  const isMobile = useIsMobile();

  // Mientras se cierra sigue enseñando lo último: sin esto la hoja bajaría vacía.
  const lastView = useRef<DetailView | null>(null);
  if (view) lastView.current = view;
  const shown = view ?? lastView.current;

  // Al entrar en un jugador el contenido llega por la derecha y al volver por la
  // izquierda, como el paso de página de una app.
  const direction = useRef<1 | -1 | 0>(0);

  const openPlayer = (playerId: string, back: ListView | null) => {
    direction.current = 1;
    onChange({ kind: 'player', playerId, back });
  };
  const goBack = (back: ListView) => {
    direction.current = -1;
    onChange(back);
  };

  const inCategory = players.filter((p) => p.categoryId === category?.id);
  const matching = inCategory.filter((p) => matchesSearch(p, query));

  let body: React.ReactNode = null;
  if (shown?.kind === 'position') {
    const all = inCategory.filter((p) => p.position === shown.position);
    body = (
      <PlayerList
        eyebrow={category?.shortName ?? ''}
        title={POSITION_LABEL[shown.position]}
        shown={matching.filter((p) => p.position === shown.position)}
        total={all.length}
        emptyText={
          all.length ? 'Ningún jugador de esta demarcación cumple la búsqueda.' : 'Demarcación vacante en esta categoría.'
        }
        onOpenPlayer={(id) => openPlayer(id, shown)}
      />
    );
  } else if (shown?.kind === 'signal') {
    const list = signalPlayers(matching, shown.signal);
    body = (
      <PlayerList
        eyebrow={category?.shortName ?? ''}
        title={SIGNALS[shown.signal].title}
        shown={list}
        total={list.length}
        emptyText="Ninguno en esta categoría."
        onOpenPlayer={(id) => openPlayer(id, shown)}
      />
    );
  } else if (shown?.kind === 'player') {
    const player = players.find((p) => p.id === shown.playerId);
    if (player) {
      const back = shown.back;
      body = (
        <PlayerCard
          player={player}
          categoryName={categories.find((c) => c.id === player.categoryId)?.name ?? ''}
          back={back}
          onBack={() => back && goBack(back)}
        />
      );
    }
  } else if (shown?.kind === 'coach') {
    const coachCategory = categories.find((c) => c.id === shown.categoryId);
    if (coachCategory) body = <CoachCard category={coachCategory} />;
  }

  const content = (
    <motion.div
      key={JSON.stringify(shown)}
      initial={{ opacity: 0, x: direction.current * 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="px-5 pb-5 pt-1 md:pt-5"
    >
      {body}
    </motion.div>
  );

  const close = (open: boolean) => {
    if (open) return;
    direction.current = 0;
    onChange(null);
  };

  if (isMobile) {
    return (
      <Dialog open={view !== null} onOpenChange={close}>
        {/* Siempre mide lo mismo: así volver cae siempre en el mismo sitio y el dedo
            lo encuentra sin mirar. */}
        <DialogContent mobileSheet focusPanelOnOpen className="h-[60dvh] p-0">
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={view !== null} onOpenChange={close}>
      <SheetContent
        side="right"
        className="w-[min(370px,92vw)] p-0 outline-none"
        // El foco entra en el panel y no en la X, que estrenaría su anillo sin que
        // nadie haya tocado el teclado.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        {content}
      </SheetContent>
    </Sheet>
  );
}
