import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/login',
    '/invite/:path*',
    '/auth/:path*',
    '/inicio/:path*',
    '/disenos/:path*',
    '/mi-semana/:path*',
    '/ajustes/:path*',
    '/equipo/:path*',
    '/ayuda/:path*',
  ],
}
