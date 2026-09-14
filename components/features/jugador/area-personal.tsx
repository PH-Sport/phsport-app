'use client';

/**
 * Área personal del futbolista — VISTA PREVIA, sin funcionalidad.
 *
 * Los datos salen de `lib/jugador/datos-de-muestra.ts` y no hay nada detrás:
 * nada se sube, nada se descarga, nada se borra. Existe para poder mirar la
 * disposición desde la app instalada antes de construir el sistema.
 *
 * Disposición elegida (la «B» de las cuatro que se compararon): cada carpeta
 * enseña una portada, y la zona de subida ocupa todo lo que sobra hasta el
 * fondo — el hueco muerto pasa a ser la diana donde se sueltan los archivos.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, Image as ImageIcon, Upload, Video, X } from 'lucide-react';
import { SPRINGS } from '@/components/ui/animations';
import { useAuth } from '@/lib/auth/auth-context';
import { CARPETAS, ENTREGAS, ENVIOS } from '@/lib/jugador/datos-de-muestra';
import { cn } from '@/lib/utils';

type Vista = 'inicio' | 'carpeta' | 'enviados';

export function AreaPersonal() {
  const [vista, setVista] = useState<Vista>('inicio');

  return (
    // svh y no vh: en iOS la barra del navegador se come el 100vh y la última
    // fila queda debajo del borde. Las safe-area son para la PWA instalada.
    <div className="mx-auto flex h-svh w-full max-w-lg flex-col pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <motion.div
        key={vista}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRINGS.gentle}
        className="flex min-h-0 flex-1 flex-col"
      >
        {vista === 'inicio' && <Inicio onAbrir={() => setVista('carpeta')} onEnviar={() => setVista('enviados')} />}
        {vista === 'carpeta' && <Carpeta onVolver={() => setVista('inicio')} />}
        {vista === 'enviados' && <Enviados onVolver={() => setVista('inicio')} />}
      </motion.div>
    </div>
  );
}

// ─── Inicio ──────────────────────────────────────────────────

function Inicio({ onAbrir, onEnviar }: { onAbrir: () => void; onEnviar: () => void }) {
  const { profile } = useAuth();
  const iniciales = (profile?.display_name ?? 'DM')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      {/* El avatar va arriba a la derecha, donde vive en el resto de la app.
          Sin nombre debajo: él ya sabe quién es. */}
      <div className="flex justify-end px-[18px] pt-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {iniciales}
        </span>
      </div>

      <h1 className="mb-5 mt-1 px-[18px] text-3xl font-bold tracking-tight">Área personal</h1>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] pb-[18px]">
        {CARPETAS.map((carpeta) => (
          <button
            key={carpeta.id}
            type="button"
            onClick={onAbrir}
            style={{ background: carpeta.portada }}
            className="relative block h-[150px] shrink-0 overflow-hidden rounded-surface shadow-raised outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent"
            />
            <span className="absolute inset-x-4 bottom-3.5 z-10 text-left text-white">
              <span className="block text-lg font-semibold tracking-tight">{carpeta.nombre}</span>
              <span className="font-mono tabular text-xs opacity-85">{carpeta.archivos} archivos</span>
            </span>
          </button>
        ))}

        {/* Crece hasta el fondo: lo que sobraba pasa a ser la diana. Con muchas
            carpetas se queda en su mínimo y el conjunto hace scroll. */}
        <div className="flex min-h-[190px] flex-1 flex-col overflow-hidden rounded-surface border border-dashed border-primary/35 bg-card">
          <button
            type="button"
            onClick={onEnviar}
            className="flex flex-1 flex-col items-center justify-center gap-3 p-[18px] outline-none transition-colors active:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Upload className="h-6 w-6" aria-hidden />
            </span>
            <span className="text-[17px] font-semibold">Subir archivos</span>
          </button>
          <button
            type="button"
            onClick={onEnviar}
            className="flex shrink-0 items-center justify-center gap-1.5 border-t border-dashed border-primary/35 p-4 text-[15px] text-muted-foreground outline-none transition-colors active:bg-muted active:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            {ENVIOS.length} enviados
            <ChevronRight className="h-[15px] w-[15px]" aria-hidden />
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Dentro de una carpeta ───────────────────────────────────

function Carpeta({ onVolver }: { onVolver: () => void }) {
  const total = CARPETAS[0].archivos;

  return (
    <>
      <Volver etiqueta="Fotos" onVolver={onVolver} />

      <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-6">
        <button
          type="button"
          className="mb-5 flex w-full items-center justify-center gap-2.5 rounded-[15px] bg-primary p-4 text-[17px] font-semibold text-primary-foreground outline-none transition-[filter] active:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Download className="h-[19px] w-[19px]" aria-hidden />
          Descargar las {total}
        </button>

        {/* Las entregas se separan por fecha, pero NO son subcarpetas: es un
            rótulo. No hay un nivel más en el que entrar. */}
        {ENTREGAS.map((entrega) => (
          <section key={entrega.id} className="mb-6">
            <div className="mb-2.5 flex items-baseline gap-2.5">
              <h2 className="text-[17px] font-semibold">{entrega.nombre}</h2>
              <span className="font-mono tabular text-xs text-muted-foreground">
                {entrega.fecha} · {entrega.total}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {entrega.miniaturas.map((fondo, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Foto ${i + 1} de ${entrega.nombre}`}
                  style={{ background: fondo }}
                  className="aspect-square rounded-[10px] outline-none transition-opacity active:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

// ─── Lo que él ha mandado ────────────────────────────────────

function Enviados({ onVolver }: { onVolver: () => void }) {
  return (
    <>
      <Volver etiqueta="Enviados" onVolver={onVolver} />

      <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-6">
        <button
          type="button"
          className="mb-5 flex w-full items-center justify-center gap-2.5 rounded-[15px] border border-dashed border-primary/35 bg-card p-4 text-[17px] font-semibold outline-none transition-colors active:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Upload className="h-[19px] w-[19px] text-primary" aria-hidden />
          Subir archivos
        </button>

        <div className="overflow-hidden rounded-surface bg-card shadow-raised">
          {ENVIOS.map((envio, i) => {
            const Icono = envio.tipo === 'video' ? Video : ImageIcon;
            return (
              <div
                key={envio.id}
                className={cn('flex items-center gap-3.5 px-4 py-3.5', i > 0 && 'border-t border-border')}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Icono className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{envio.nombre}</span>
                  <span className="font-mono tabular text-xs text-muted-foreground">
                    {envio.cuando} · {envio.peso}
                  </span>
                </span>
                {/* Puede quitar lo que él mandó; lo que le disteis vosotros, no. */}
                <button
                  type="button"
                  aria-label={`Quitar ${envio.nombre}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors active:bg-muted active:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <X className="h-[17px] w-[17px]" aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Compartido ──────────────────────────────────────────────

function Volver({ etiqueta, onVolver }: { etiqueta: string; onVolver: () => void }) {
  return (
    <button
      type="button"
      onClick={onVolver}
      className="flex items-center gap-2 self-start rounded-xl px-[18px] pb-4 pt-3.5 text-xl font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronLeft className="h-5 w-5 text-primary" aria-hidden />
      {etiqueta}
    </button>
  );
}
