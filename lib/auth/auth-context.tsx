'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { LogoutOverlay } from '@/components/ui/logout-overlay';
import { logger } from '@/lib/utils/logger';
import { setSwrCacheOwner, clearSwrCache } from '@/lib/swr/persistent-cache';
import {
  deriveAccess,
  toProfile,
  PROFILE_WITH_ROLES_SELECT,
  type Access,
  type ProfileWithRoles,
} from '@/lib/utils/access';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Perfil con sus roles ya aplanados (ver lib/utils/access.ts). `full_name` y
 * `display_name` los genera la BD: Nombre + Primer apellido, y alias || nombre.
 */
export type Profile = ProfileWithRoles;

type AuthStatus = 'INITIALIZING' | 'AUTHENTICATED' | 'UNAUTHENTICATED';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  profile: Profile | null;
  /** Permisos derivados del perfil; vacío sin sesión. Preguntar con `access.can('…')`. */
  access: Access;
  loggingOut: boolean;
}

/** Sin sesión no queda nada: ni perfil ni permisos. Un solo sitio para no olvidar `access`. */
const signedOut = (prev: AuthState): AuthState => ({
  ...prev,
  status: 'UNAUTHENTICATED',
  user: null,
  profile: null,
  access: deriveAccess(null),
});

interface AuthContextType extends AuthState {
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

// ============================================================================
// Context Definition
// ============================================================================

export const AuthContext = createContext<AuthContextType>({
  status: 'INITIALIZING',
  user: null,
  profile: null,
  access: deriveAccess(null),
  loggingOut: false,
  logout: async () => {},
  refreshSession: async () => {},
});

// ============================================================================
// Provider Component
// ============================================================================

interface AuthProviderProps {
  children: React.ReactNode;
  /** Estado inicial resuelto en el servidor (Fase 2): evita el spinner de auth. */
  initialUser?: User | null;
  initialProfile?: Profile | null;
}

export function AuthProvider({
  children,
  initialUser = null,
  initialProfile = null,
}: AuthProviderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  // Si el servidor ya verificó sesión + perfil, arrancamos AUTHENTICATED.
  const hasServerSession = Boolean(initialUser && initialProfile);

  // Single source of truth for Auth State
  const [state, setState] = useState<AuthState>({
    status: hasServerSession ? 'AUTHENTICATED' : 'INITIALIZING',
    user: initialUser,
    profile: initialProfile,
    access: deriveAccess(initialProfile),
    loggingOut: false,
  });

  // --------------------------------------------------------------------------
  // Core Logic: Atomic Initialization
  // --------------------------------------------------------------------------

  const initializeAuth = useCallback(async (isMount = false) => {
    try {
      if (!isMount) {
        logger.log('[Auth] Refreshing session...');
      }

      // 1. Get User
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        logger.log('[Auth] No active session found.');
        setState(signedOut);
        return;
      }

      // 2. Get Profile (Required for AUTHENTICATED state)
      const { data: rawProfile, error: profileError } = await supabase
        .from('profiles')
        .select(PROFILE_WITH_ROLES_SELECT)
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        logger.error('[Auth] Profile fetch failed:', profileError);
        // Decision: If profile fails, is it a retry-able network error?
        // For simplicity and robustness: Treat as invalid session for now.
        // Ideally, we could add an ERROR state here with a "Retry" button.
        throw new Error('Profile fetch failed');
      }

      if (!rawProfile) {
        logger.warn('[Auth] User exists but has NO profile. Critical data error.');
        // User without profile -> Invalid state -> Force Logout
        await supabase.auth.signOut();
        setState(signedOut);
        return;
      }

      const profile = toProfile(rawProfile);

      // 3. Success -> Fully Authenticated
      // Marca al dueño de la caché SWR persistida (aislamiento por usuario).
      setSwrCacheOwner(user.id);

      // Only update state if user/profile actually changed (prevents unnecessary re-renders)
      setState(prev => {
        const isSameUser = prev.user?.id === user.id;
        const isSameProfile =
          prev.profile?.id === profile.id &&
          prev.profile?.full_name === profile.full_name &&
          prev.profile?.display_name === profile.display_name &&
          prev.profile?.kind === profile.kind &&
          JSON.stringify(prev.profile?.roles) === JSON.stringify(profile.roles) &&
          prev.profile?.avatar_url === profile.avatar_url &&
          prev.profile?.is_dev === profile.is_dev &&
          prev.profile?.accent_color === profile.accent_color;

        // If nothing changed, return previous state to avoid re-render
        if (prev.status === 'AUTHENTICATED' && isSameUser && isSameProfile) {
          logger.log('[Auth] Session verified, no changes detected.');
          return prev;
        }

        logger.log('[Auth] Session & Profile verified. Access granted.');
        return {
          ...prev,
          status: 'AUTHENTICATED',
          user,
          profile,
          access: deriveAccess(profile),
        };
      });

    } catch (error) {
      logger.error('[Auth] Initialization error:', error);
      // Fail-safe: Default to unauthenticated to prevent zombie UI
      setState(signedOut);
    }
  }, [supabase]);

  // --------------------------------------------------------------------------
  // Lifecycle & Effects
  // --------------------------------------------------------------------------

  // Initial Mount
  useEffect(() => {
    if (hasServerSession && initialUser) {
      // Sesión ya verificada por el servidor: no repetimos el getUser()+profile
      // bloqueante. Solo marcamos al dueño de la caché SWR persistida (Fase 1).
      setSwrCacheOwner(initialUser.id);
    } else {
      initializeAuth(true);
    }

    // Supabase Auth Listener (Handles other tabs, token refreshes, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      logger.log(`[Auth] Event: ${event}`);

      if (event === 'SIGNED_OUT') {
        setState(signedOut);
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Re-run full check to ensure profile is consistent
        initializeAuth();
      } else if (event === 'TOKEN_REFRESHED') {
        // Just update token, state remains authenticated usually
        // But safe to do nothing if we trust the session is valid
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initializeAuth, supabase.auth, hasServerSession, initialUser]);

  // "Hotel Sensor": Reset loggingOut flag when we actually land on login page
  useEffect(() => {
    if (pathname === '/login' && state.loggingOut) {
      setState(prev => ({ ...prev, loggingOut: false }));
    }
  }, [pathname, state.loggingOut]);

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  const logout = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loggingOut: true }));
      // Optimistic UI clear
      await supabase.auth.signOut();

      // Limpiar SOLO claves auth de Supabase (preservamos theme, sidebar-collapsed, etc.).
      if (typeof window !== 'undefined') {
        const clearSupabaseKeys = (storage: Storage) => {
          const keysToRemove: string[] = [];
          for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key && key.startsWith('sb-')) keysToRemove.push(key);
          }
          keysToRemove.forEach((k) => storage.removeItem(k));
        };
        clearSupabaseKeys(window.localStorage);
        clearSupabaseKeys(window.sessionStorage);
      }

      // Limpiar la caché SWR persistida para que el siguiente usuario no vea datos ajenos.
      clearSwrCache();

      router.push('/login');
      // State update happens via onAuthStateChange --> SIGNED_OUT
    } catch (error) {
      logger.error('Logout error:', error);
      setState(signedOut);
      router.push('/login');
    }
  }, [router, supabase.auth]);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  const value = useMemo(() => ({
    ...state,
    logout,
    refreshSession: () => initializeAuth(),
  }), [state, initializeAuth, logout]);

  return (
    <AuthContext.Provider value={value}>
      <LogoutOverlay isVisible={state.loggingOut} />
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
