import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { config } from '@/lib/config'
import { logger } from '@/lib/utils/logger'
import { homeFor, toProfile, PROFILE_WITH_ROLES_SELECT, viewModeFor } from '@/lib/utils/access'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    config.supabase.url,
    config.supabase.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  // Sin cookie de sesión, getUser() no devuelve «usuario nulo» sin más: devuelve
  // también un error (AuthSessionMissingError). Tratarlo como fallo salía caro:
  // el anónimo se servía la página protegida entera y era el cliente quien lo
  // mandaba a /login (revisión del 2026-09-21). Sin sesión es «sin sesión»; el
  // retorno temprano se reserva para errores de verdad (red, Auth caído).
  const noSession = !user && (!userError || userError.name === 'AuthSessionMissingError')
  if (userError && !noSession) {
    logger.serverError('[Auth] getUser error in middleware:', userError)
    return response
  }

  const path = request.nextUrl.pathname

  // Handlers que canjean un token de email (recuperación, invitación, cambio de email).
  // Tener sesión abierta no puede desviarlos: el enlace debe llegar a su destino aunque
  // el usuario siga logueado en ese navegador —el caso típico de "olvidé la contraseña".
  const isAuthHandler = path.startsWith('/auth')

  // Rutas públicas que no requieren auth
  const isPublicRoute = path === '/login' || path.startsWith('/invite') || isAuthHandler

  // Redirecciones
  if (!user && !isPublicRoute) {
    // Si no hay usuario y trata de ir a protegida -> Login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isPublicRoute && !isAuthHandler) {
    // Solo en el caso raro —entrar en /login o en una invitación con sesión
    // abierta— hace falta saber qué cara toca (mánager, diseñador o agente), y
    // eso sí exige leer el perfil. El camino normal no pasa por aquí ni toca
    // la base: cada consulta de este archivo la paga cada navegación.
    const { data: raw } = await supabase
      .from('profiles')
      .select(PROFILE_WITH_ROLES_SELECT)
      .eq('id', user.id)
      .maybeSingle()
    const url = request.nextUrl.clone()
    url.pathname = homeFor(viewModeFor(raw ? toProfile(raw) : null))
    return NextResponse.redirect(url)
  }

  return response
}
