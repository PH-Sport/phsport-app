import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * admin-delete-user — elimina un miembro del equipo.
 *
 * Seguridad: solo quien tiene el permiso `gestionar_roles` puede invocarla; se
 * verifica con el JWT del llamante y preguntándole a la base (has_permission,
 * la misma función que usan las políticas), no confiando en el cliente. El
 * service-role vive aquí, en Supabase, nunca en el runtime de Next.
 *
 * "Mantén sus diseños": antes de borrar se reasigna designs.created_by (FK
 * RESTRICT) al Mánager que ejecuta la acción. Al eliminar la cuenta auth, la
 * cascada borra el perfil y deja designer_id/reviewed_by en NULL — los diseños
 * se conservan, solo quedan sin asignar.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No autorizado" }, 401);

  // Cliente con la sesión del llamante para identificarlo.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller) return json({ error: "No autorizado" }, 401);

  // Cliente con service-role para verificar el rol de forma autoritativa y mutar.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: allowed, error: permError } = await admin.rpc("has_permission", {
    uid: caller.id,
    perm: "gestionar_roles",
  });
  if (permError) return json({ error: "Error al verificar permisos" }, 500);
  if (allowed !== true) return json({ error: "Prohibido" }, 403);

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Cuerpo inválido" }, 400);
  }
  const userId = body.userId;
  if (!userId || typeof userId !== "string") {
    return json({ error: "userId requerido" }, 400);
  }
  if (userId === caller.id) {
    return json({ error: "No puedes eliminarte a ti mismo" }, 403);
  }

  // El objetivo debe existir.
  const { data: targetProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (!targetProfile) return json({ error: "Usuario no encontrado" }, 404);

  // Conservar los diseños que creó: reasignar el campo de auditoría (FK RESTRICT)
  // al Mánager que ejecuta el borrado, para no bloquear la cascada.
  const { error: reassignError } = await admin
    .from("designs")
    .update({ created_by: caller.id })
    .eq("created_by", userId);
  if (reassignError) {
    return json({ error: "No se pudieron reasignar los diseños creados" }, 500);
  }

  // Eliminar la cuenta auth → cascada borra el perfil; designer_id/reviewed_by → NULL.
  // La guardia de la base aborta el borrado si es la última persona con
  // gestionar_roles (la cascada llegaría a profile_roles): se explica, no se esconde.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    if (String(deleteError.message).includes("gestionar_roles")) {
      return json(
        { error: "Es la última persona que gestiona roles. Dale el permiso a otra antes de borrarla." },
        409
      );
    }
    return json({ error: "No se pudo eliminar la cuenta" }, 500);
  }

  return json({ ok: true });
});
