import type { Cache } from 'swr';

/**
 * Caché SWR persistente en localStorage — Fase 1 del "caching inteligente".
 *
 * Objetivo: "instant-on". Al recargar o volver a entrar, los datos de la última
 * sesión se hidratan de forma SÍNCRONA antes del primer render, así que las
 * pantallas aparecen con datos en vez de skeleton y SWR revalida por detrás.
 * Cold start pasa de [auth → skeleton de datos → datos] a [auth → datos].
 *
 * Aislamiento por usuario (sin fuga de datos en equipos compartidos):
 *   - La caché se guarda namespaceada por el id del último usuario autenticado
 *     (marcador `phsport-swr-owner`, escrito por AuthProvider al autenticar).
 *   - Solo se hidrata si (a) existe ese marcador y (b) hay una cookie de sesión
 *     de Supabase presente ahora mismo. Si el usuario anterior hizo logout o su
 *     sesión caducó, la cookie no está → no se hidrata nada → es imposible
 *     mostrar datos de otro usuario. (Un usuario distinto solo puede entrar tras
 *     limpiarse la cookie del anterior, lo que invalida el gate.)
 *   - Versionado (CACHE_VERSION) + TTL para no resucitar datos rotos o muy viejos.
 *
 * Modo de fallo seguro: cualquier error, o localStorage no disponible (incógnito,
 * lleno), cae a caché en memoria → comportamiento idéntico al actual.
 */

const CACHE_VERSION = 'v1';
const OWNER_KEY = 'phsport-swr-owner';
const TS_KEY = 'phsport-swr-ts';
const KEY_PREFIX = 'phsport-swr'; // clearSwrCache borra todo lo que empiece así
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * La cartera de jugadores nunca se guarda en el equipo: lleva datos de menores, y
 * lo que hay en localStorage sigue ahí legible aunque la sesión caduque (el TTL
 * impide hidratarlo, pero no lo borra). Cuesta un esqueleto al abrir en frío.
 */
const NEVER_PERSISTED = new Set(['portfolio', 'portfolio-names']);

export function persistableEntries(map: Map<string, unknown>): [string, unknown][] {
  return Array.from(map.entries()).filter(([key]) => !NEVER_PERSISTED.has(key));
}

function cacheKey(ownerId: string) {
  return `${KEY_PREFIX}:${CACHE_VERSION}:${ownerId}`;
}

/** ¿Hay una cookie de sesión de Supabase ahora mismo? (chequeo barato, sin decodificar) */
function hasSupabaseSessionCookie(): boolean {
  try {
    return document.cookie.includes('-auth-token');
  } catch {
    return false;
  }
}

/** Borra toda la caché SWR persistida + marcadores. Llamar en logout. */
export function clearSwrCache(): void {
  try {
    if (typeof window === 'undefined') return;
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* noop */
  }
}

/** Marca al usuario dueño de la caché actual. Llamar al autenticar. */
export function setSwrCacheOwner(userId: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(OWNER_KEY, userId);
  } catch {
    /* noop */
  }
}

/**
 * Provider de caché para `<SWRConfig provider={localStorageProvider}>`.
 * Se evalúa una sola vez en cliente.
 */
export function localStorageProvider(): Cache {
  // SSR / sin window → Map en memoria (los dashboards montan tras hidratar, así
  // que esto evita cualquier hydration mismatch).
  if (typeof window === 'undefined') {
    return new Map();
  }

  const map = new Map<string, unknown>();

  try {
    const ownerId = window.localStorage.getItem(OWNER_KEY);
    const ts = Number(window.localStorage.getItem(TS_KEY) || '0');
    const fresh = ts > 0 && Date.now() - ts < MAX_AGE_MS;

    if (ownerId && hasSupabaseSessionCookie() && fresh) {
      const raw = window.localStorage.getItem(cacheKey(ownerId));
      if (raw) {
        const entries = JSON.parse(raw) as [string, unknown][];
        // El filtro también aquí: una caché guardada antes de existir esta regla
        // no vuelve a la memoria, y se reescribe sin ella en cuanto se persista.
        for (const [k, v] of entries) if (!NEVER_PERSISTED.has(k)) map.set(k, v);
      }
    }
  } catch {
    // Caché corrupta / no disponible → empezamos limpios.
    map.clear();
  }

  // Persistir de vuelta al cerrar u ocultar la pestaña.
  const persist = () => {
    try {
      const ownerId = window.localStorage.getItem(OWNER_KEY);
      if (!ownerId) return; // solo persistimos para usuarios autenticados
      window.localStorage.setItem(cacheKey(ownerId), JSON.stringify(persistableEntries(map)));
      window.localStorage.setItem(TS_KEY, String(Date.now()));
    } catch {
      /* localStorage lleno / no disponible → ignorar */
    }
  };

  window.addEventListener('beforeunload', persist);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persist();
  });

  return map as unknown as Cache;
}
