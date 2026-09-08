'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { parseDismissedIds, serializeDismissedIds } from './select';

/**
 * Consejos que el usuario ya ha descartado, recordados EN ESTE DISPOSITIVO.
 *
 * localStorage y no la base de datos, a propósito: el precedente de la casa es
 * `defaultView`, no hay entorno de pruebas separado —la base de desarrollo es
 * la de producción— y lo peor que pasa por no viajar con la cuenta es que un
 * aviso ya visto vuelva a salir una vez al entrar desde otro aparato. Guardar
 * esto no valía una migración sobre la base real.
 */
const STORAGE_KEY = 'phsport:help:dismissed';

// Copia en memoria compartida por todos los que usen el hook: sin ella, el
// aviso de una página y el botón de restaurar de /ayuda tendrían cada uno su
// propia idea de lo que está descartado.
let cache: readonly string[] | null = null;
const listeners = new Set<() => void>();

function read(): readonly string[] {
  if (cache) return cache;
  try {
    cache = parseDismissedIds(localStorage.getItem(STORAGE_KEY));
  } catch {
    // Incógnito estricto o almacenamiento bloqueado: se sigue funcionando,
    // simplemente sin memoria entre visitas.
    cache = [];
  }
  return cache;
}

function write(next: readonly string[]): void {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, serializeDismissedIds(next));
  } catch {
    /* sin persistir, pero la sesión en curso sí lo respeta */
  }
  listeners.forEach((notify) => notify());
}

// useLayoutEffect en cliente (leído antes del primer paint → el aviso ya
// descartado no llega a asomar), useEffect en servidor para no avisar en SSR.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface DismissedTipsApi {
  /** False hasta haber leído el almacenamiento. No pintes avisos hasta que sea true. */
  ready: boolean;
  isDismissed: (id: string) => boolean;
  dismiss: (id: string) => void;
  /** Vuelve a enseñarlos todos. Lo usa el botón de /ayuda. */
  restoreAll: () => void;
  dismissedCount: number;
}

export function useDismissedTips(): DismissedTipsApi {
  // null = todavía no leído. Distinguirlo de [] es lo que permite no pintar
  // un aviso que resultará estar descartado.
  const [ids, setIds] = useState<readonly string[] | null>(null);

  useIsomorphicLayoutEffect(() => {
    const sync = () => setIds(read());
    sync();
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const isDismissed = useCallback((id: string) => (ids ?? []).includes(id), [ids]);

  const dismiss = useCallback((id: string) => {
    const current = read();
    if (current.includes(id)) return;
    write([...current, id]);
  }, []);

  const restoreAll = useCallback(() => {
    write([]);
  }, []);

  return {
    ready: ids !== null,
    isDismissed,
    dismiss,
    restoreAll,
    dismissedCount: ids?.length ?? 0,
  };
}
