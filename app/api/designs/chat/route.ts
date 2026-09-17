import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assignableProfiles } from '@/lib/services/profiles/assignable';
import { logger } from '@/lib/utils/logger';
import { designChatSchema } from '@/lib/api/schemas';
import { validationErrorResponse, unauthorizedResponse } from '@/lib/api/errors';
import {
  normalizeCandidate,
  type ParseDesigner,
  type RawModelDesign,
} from '@/lib/services/designs/parse-message';
import {
  CHAT_TOOLS,
  buildChatSystemPrompt,
  normalizeUpdate,
  trimHistory,
  type CardSnapshot,
  type NormalizedUpdate,
  type RawModelUpdate,
  type ToolCall,
} from '@/lib/services/designs/chat-agent';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_DESIGNS = 20;

type ChatResponse =
  | { fallback: false; text: string; calls: ToolCall[] }
  | { fallback: true; reason: 'sin_api_key' | 'error_agente' };

interface ToolUseBlock {
  type: 'tool_use';
  name: string;
  input: unknown;
}

interface TextBlock {
  type: 'text';
  text: string;
}

function isToolUse(block: unknown): block is ToolUseBlock {
  return !!block && typeof block === 'object' && (block as { type?: unknown }).type === 'tool_use';
}

function isText(block: unknown): block is TextBlock {
  return !!block && typeof block === 'object' && (block as { type?: unknown }).type === 'text';
}

/**
 * Un turno del agente conversacional de alta de diseños. Sin estado: el hilo
 * y la foto del taller llegan en cada petición, así que el servidor no tiene
 * nada que recordar entre turnos.
 *
 * Una sola llamada al modelo por turno — las herramientas las aplica el
 * cliente sobre su borrador, no hay bucle de agente. Cualquier fallo tras la
 * autenticación cae a `{ fallback: true }` con 200: el chat nunca debe ver un
 * error de servidor.
 */
export async function POST(request: Request) {
  const reqId = crypto.randomUUID();
  const startedAt = Date.now();

  const rawBody = await request.json().catch(() => ({}));
  const parsed = designChatSchema.safeParse(rawBody);
  if (!parsed.success) return validationErrorResponse(parsed.error, reqId);
  const { messages } = parsed.data;
  // Los campos anulables del schema llegan como opcionales: se fijan a null
  // para que el snapshot tenga siempre la misma forma que espera el agente.
  const cards: CardSnapshot[] = parsed.data.cards.map((c) => ({
    ...c,
    type: c.type ?? null,
    deadline_at: c.deadline_at ?? null,
    designer_name: c.designer_name ?? null,
  }));

  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) return unauthorizedResponse();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.serverInfo('[API Chat] Sin ANTHROPIC_API_KEY, fallback', {
      reqId,
      userId: data.user.id,
    });
    return NextResponse.json<ChatResponse>(
      { fallback: true, reason: 'sin_api_key' },
      { status: 200 }
    );
  }

  try {
    const { data: designers, error: designersError } = await assignableProfiles<{
      id: string;
      display_name: string | null;
      full_name: string | null;
    }>(supabase, 'id, display_name, full_name');

    if (designersError) throw designersError;

    const parseDesigners: ParseDesigner[] = designers ?? [];
    const designerNames = parseDesigners
      .map((d) => d.display_name || d.full_name || '')
      .filter((name) => name.length > 0);

    const today = new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'full',
      timeZone: 'Europe/Madrid',
    }).format(new Date());

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 2000,
          temperature: 0,
          system: buildChatSystemPrompt({ today, designerNames, cards }),
          // El hilo viaja como texto plano: el estado real de las tarjetas ya
          // va en el prompt de sistema, así que no hacen falta los bloques
          // tool_use/tool_result ni su emparejamiento.
          messages: trimHistory(messages).map((t) => ({ role: t.role, content: t.text })),
          tools: CHAT_TOOLS,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Anthropic API respondió ${response.status}: ${errorText.slice(0, 500)}`);
    }

    const payload: unknown = await response.json();
    const content = (payload as { content?: unknown })?.content;
    const blocks = Array.isArray(content) ? content : [];

    const text = blocks
      .filter(isText)
      .map((b) => b.text)
      .join('\n')
      .trim();

    // Solo se acepta lo que apunte a tarjetas que existen de verdad.
    const known = new Set(cards.map((c) => c.id));
    const now = new Date();
    const calls: ToolCall[] = [];

    for (const block of blocks.filter(isToolUse)) {
      const input = (block.input ?? {}) as Record<string, unknown>;

      if (block.name === 'add_designs' && Array.isArray(input.designs)) {
        const capped = (input.designs as RawModelDesign[]).slice(0, MAX_DESIGNS);
        if (capped.length > 0) {
          calls.push({
            tool: 'add_designs',
            designs: capped.map((raw) => normalizeCandidate(raw, parseDesigners, now)),
          });
        }
      }

      if (block.name === 'update_designs' && Array.isArray(input.updates)) {
        const updates = (input.updates as RawModelUpdate[])
          .map((raw) => normalizeUpdate(raw, known, parseDesigners, now))
          .filter((u): u is NormalizedUpdate => u !== null);
        if (updates.length > 0) calls.push({ tool: 'update_designs', updates });
      }

      if (block.name === 'remove_designs' && Array.isArray(input.ids)) {
        const ids = (input.ids as unknown[]).filter(
          (id): id is string => typeof id === 'string' && known.has(id)
        );
        if (ids.length > 0) calls.push({ tool: 'remove_designs', ids });
      }

      if (block.name === 'ask' && typeof input.question === 'string') {
        const rawOptions = Array.isArray(input.options) ? input.options : [];
        const options = rawOptions
          .filter(
            (o): o is { label: string; value: string } =>
              !!o &&
              typeof o === 'object' &&
              typeof (o as { label?: unknown }).label === 'string' &&
              typeof (o as { value?: unknown }).value === 'string'
          )
          .slice(0, 3);
        calls.push({ tool: 'ask', question: input.question, options });
      }
    }

    logger.serverInfo('[API Chat] Success', {
      reqId,
      userId: data.user.id,
      tools: calls.map((c) => c.tool),
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json<ChatResponse>({ fallback: false, text, calls }, { status: 200 });
  } catch (error) {
    logger.serverError('[API Chat] Fallback por error del agente', {
      reqId,
      userId: data.user.id,
      durationMs: Date.now() - startedAt,
      error,
    });
    return NextResponse.json<ChatResponse>(
      { fallback: true, reason: 'error_agente' },
      { status: 200 }
    );
  }
}
