'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Link2, Pencil, Trash2 } from 'lucide-react';

import { Collapse } from '@/components/ui/collapse';
import { SPRINGS } from '@/components/ui/animations';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  DESIGN_TYPES,
  DESIGN_TYPE_LABELS,
  DESIGN_TYPE_WEIGHT,
  getDesignWeightValue,
  type DesignType,
} from '@/lib/types/design';
import { autoTitleFor, effectiveTitle, type DesignCard } from '@/lib/utils/design-cards';
import type { Designer } from '@/lib/hooks/use-designers';
import { WEIGHT_COLORS } from './weight-chip';
import { HelpHint } from '@/components/ui/help-hint';
import { CardSummaryRow } from './card-summary-row';

export interface DesignCardItemProps {
  card: DesignCard;
  /** 1-based; se muestra "01", "02"… en mono. */
  index: number;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<DesignCard>) => void;
  onRemove: () => void;
  canRemove: boolean;
  designers: Designer[];
  loadingDesigners: boolean;
  /** El diálogo lo calcula con `isOutsideWeek`. */
  outsideWeek: boolean;
}

export function DesignCardItem({
  card,
  index,
  open,
  onToggle,
  onChange,
  onRemove,
  canRemove,
  designers,
  loadingDesigners,
  outsideWeek,
}: DesignCardItemProps) {
  const [driveOpen, setDriveOpen] = useState(() => card.folder_url.trim() !== '');
  const [titleOpen, setTitleOpen] = useState(() => card.titleEdited);

  const hasMatch = card.type === 'matchday';
  const designerName = card.designer_id
    ? (designers.find((d) => d.id === card.designer_id)?.displayName ?? 'Auto')
    : 'Auto';
  const titleInputValue = card.titleEdited ? card.title : effectiveTitle(card);

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card transition-shadow hover:shadow-sm',
        open && 'border-border/80 shadow-sm'
      )}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className="flex cursor-pointer items-center gap-3 px-4 py-3"
      >
        <CardSummaryRow
          card={card}
          index={index}
          designerName={designerName}
          outsideWeek={outsideWeek}
        />
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={SPRINGS.snappy}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </motion.span>
      </div>

      <Collapse open={open}>
        <div className="space-y-4 border-t border-border/60 px-4 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              {/* El desplegable ya enseña un número por tipo (el peso). Aquí se
                  explica de dónde sale y por qué decide a quién le toca. */}
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">Tipo</Label>
                <HelpHint tipId="peso-por-tipo" align="start" />
              </div>
              <Select
                value={card.type ?? ''}
                onValueChange={(value) => onChange({ type: value as DesignType })}
              >
                <SelectTrigger className="h-10 md:h-9">
                  <SelectValue placeholder="Elegir tipo" />
                </SelectTrigger>
                <SelectContent>
                  {DESIGN_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            WEIGHT_COLORS[DESIGN_TYPE_WEIGHT[t]].dot
                          )}
                        />
                        {DESIGN_TYPE_LABELS[t]}
                        <span className="font-mono text-[11px] md:text-[10px] text-muted-foreground">
                          · {getDesignWeightValue(t)}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`player-${card.id}`} className="text-xs">Jugador</Label>
              <Input
                id={`player-${card.id}`}
                className="h-10 md:h-9"
                value={card.player}
                onChange={(e) => onChange({ player: e.target.value })}
                placeholder="Nombre del jugador"
              />
            </div>

            {hasMatch && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor={`local-${card.id}`} className="text-xs">Local</Label>
                  <Input
                    id={`local-${card.id}`}
                    className="h-10 md:h-9"
                    value={card.match_home}
                    onChange={(e) => onChange({ match_home: e.target.value })}
                    placeholder="Equipo local"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`away-${card.id}`} className="text-xs">Visitante</Label>
                  <Input
                    id={`away-${card.id}`}
                    className="h-10 md:h-9"
                    value={card.match_away}
                    onChange={(e) => onChange({ match_away: e.target.value })}
                    placeholder="Equipo visitante"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Entrega</Label>
              <DateTimePicker
                className="h-10 md:h-9"
                value={card.deadline_at}
                onChange={(date) => onChange({ deadline_at: date })}
                placeholder="Fecha y hora"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Diseñador</Label>
              <Select
                value={card.designer_id ?? 'auto'}
                onValueChange={(value) =>
                  onChange({ designer_id: value === 'auto' ? null : value })
                }
              >
                <SelectTrigger className="h-10 md:h-9">
                  <SelectValue placeholder="Automático" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático</SelectItem>
                  {loadingDesigners ? (
                    <SelectItem value="loading" disabled>
                      Cargando…
                    </SelectItem>
                  ) : (
                    designers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.displayName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`details-${card.id}`} className="text-xs">Detalles</Label>
            <Textarea
              id={`details-${card.id}`}
              rows={2}
              value={card.details}
              onChange={(e) => onChange({ details: e.target.value })}
              placeholder="Rival, motivo, detalle de la pieza…"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDriveOpen((v) => !v)}
              className="text-muted-foreground"
            >
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
              Carpeta de Drive
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTitleOpen((v) => !v)}
              className="text-muted-foreground"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Título
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={!canRemove}
              className="ml-auto text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Quitar
            </Button>
          </div>

          <Collapse open={driveOpen}>
            <Input
              type="url"
              className="h-10 md:h-9"
              value={card.folder_url}
              onChange={(e) => onChange({ folder_url: e.target.value })}
              placeholder="https://drive.google.com/..."
            />
          </Collapse>

          <Collapse open={titleOpen}>
            <div className="flex items-center gap-2">
              <Input
                className="h-10 md:h-9"
                value={titleInputValue}
                onChange={(e) => {
                  const value = e.target.value;
                  onChange({ title: value, titleEdited: value.trim() !== '' });
                }}
                placeholder={autoTitleFor(card) || 'Título'}
              />
              <span className="shrink-0 font-mono text-[11px] md:text-[10px] text-muted-foreground">
                {card.titleEdited ? 'editado' : 'auto'}
              </span>
            </div>
          </Collapse>
        </div>
      </Collapse>
    </div>
  );
}
