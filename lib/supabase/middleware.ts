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

  if (userError) {
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

  if (user && !isAuthHandler) {
    const { data: raw } = await supabase
      .from('profiles')
      .select(PROFILE_WITH_ROLES_SELECT)
      .eq('id', user.id)
      .maybeSingle()
    const mode = viewModeFor(raw ? toProfile(raw) : null)

    // Con sesión, /login y /invite llevan a la casa que le toca a la cuenta.
    if (isPublicRoute) {
      const url = request.nextUrl.clone()
      url.pathname = homeFor(mode)
      return NextResponse.redirect(url)
    }

    // Cada clase de cuenta tiene su marco (spec §1): un futbolista no pisa el
    // panel de la agencia, y la agencia no tiene área personal. Los marcos lo
    // repiten en el cliente; aquí se decide antes de servir nada.
    const isPlayerArea = path.startsWith('/area-personal')
    if ((mode === 'player') !== isPlayerArea) {
      const url = request.nextUrl.clone()
      url.pathname = homeFor(mode)
      return NextResponse.redirect(url)
    }
  }

  return response
}
