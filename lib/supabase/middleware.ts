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

  if (user) {
    // Si hay usuario y trata de ir a login/register -> redirigir según rol
    if (isPublicRoute && !isAuthHandler) {
      // Con sesión, /login y /invite llevan a la casa que le toca a la cuenta.
      const { data: raw } = await supabase
        .from('profiles')
        .select(PROFILE_WITH_ROLES_SELECT)
        .eq('id', user.id)
        .maybeSingle()

      const url = request.nextUrl.clone()
      url.pathname = homeFor(viewModeFor(raw ? toProfile(raw) : null))
      return NextResponse.redirect(url)
    }
  }

  return response
}
