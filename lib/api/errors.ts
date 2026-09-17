import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from '@/lib/utils/logger';

const isProd = process.env.NODE_ENV === 'production';

interface ErrorBody {
  error: string;
  details?: unknown;
}

function buildErrorBody(message: string, details?: unknown): ErrorBody {
  if (isProd || details === undefined) return { error: message };
  return { error: message, details };
}

/** Devuelve respuesta 400 con detalles de validación zod en dev, mensaje genérico en prod. */
export function validationErrorResponse(error: ZodError, reqId?: string): NextResponse {
  const flat = error.flatten();
  logger.serverInfo('[API] Validation failed', { reqId, issues: flat });
  return NextResponse.json(
    buildErrorBody('Datos inválidos', flat),
    { status: 400 }
  );
}

/**
 * Mapea errores genéricos a respuesta 500 sin filtrar mensajes internos en producción.
 * En dev incluye `details` para diagnóstico rápido.
 */
export function internalErrorResponse(error: unknown, context: string, reqId?: string): NextResponse {
  logger.serverError(`[API] ${context}`, { reqId, error });
  const details = error instanceof Error ? { name: error.name, message: error.message } : error;
  return NextResponse.json(
    buildErrorBody('Error interno del servidor', details),
    { status: 500 }
  );
}

/** Respuesta 401 estándar. */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
}

/** Respuesta 403 estándar. */
export function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
}

/** Respuesta 404 estándar. */
export function notFoundResponse(resource = 'Recurso'): NextResponse {
  return NextResponse.json({ error: `${resource} no encontrado` }, { status: 404 });
}

/**
 * La guardia de la base (trigger) y los `raise … using errcode = 'check_violation'`
 * llegan como 23514. Se devuelven como 409 con su mensaje, que ya está en castellano.
 */
export function conflictFromDbError(error: { code?: string; message?: string } | null): NextResponse | null {
  if (!error || error.code !== '23514') return null;
  return NextResponse.json({ error: error.message ?? 'Conflicto' }, { status: 409 });
}
