'use client';

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { AuthContext, useAuth, type Profile } from '@/lib/auth/auth-context';
import type { Designer } from '@/lib/hooks/use-designers';
import { deriveAccess, viewModeFor, type ProfileRole, type ViewMode } from '@/lib/utils/access';

const STORAGE_KEY = 'phsport:view-as';

interface ViewAsState {
  mode: 'real' | 'designer';
  designerId: string | null;
  designerName: string | null;
  /** Roles reales de la persona simulada: la simulación enseña SU cara, no una inventada. */
  designerRoles: ProfileRole[];
}

interface ViewAsContextValue {
  /** La cuenta real es dev (is_dev en Supabase) y es de la agencia. */
  isDev: boolean;
  /** Hay una simulación activa. */
  simulating: boolean;
  simulatedDesignerId: string | null;
  simulatedDesignerName: string | null;
  enterDesignerView: (designer: Designer) => void;
  exitToManager: () => void;
  /** Identidad REAL (para el menú de cuenta y la píldora). */
  realName: string | null;
  /** Nombre corto real (display_name) para el día a día. */
  realDisplayName: string | null;
  realEmail: string | null;
  realProfile: Profile | null;
  realViewMode: ViewMode;
  realAvatarUrl: string | null;
}

const ViewAsContext = createContext<ViewAsContextValue>({
  isDev: false,
  simulating: false,
  simulatedDesignerId: null,
  simulatedDesignerName: null,
  enterDesignerView: () => {},
  exitToManager: () => {},
  realName: null,
  realDisplayName: null,
  realEmail: null,
  realProfile: null,
  realViewMode: 'designer',
  realAvatarUrl: null,
});

const REAL: ViewAsState = { mode: 'real', designerId: null, designerName: null, designerRoles: [] };

export function ViewAsProvider({ children }: { children: React.ReactNode }) {
  // useAuth() aquí resuelve al AuthProvider de la raíz => identidad REAL.
  const auth = useAuth();
  const realUser = auth.user;
  const realProfile = auth.profile;

  const isDev = realProfile?.is_dev === true && realProfile.kind === 'AGENCIA';

  const [state, setState] = useState<ViewAsState>(REAL);

  // Cargar estado persistido (solo cliente, tras montar para evitar mismatch SSR).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ViewAsState>;
      if (parsed && (parsed.mode === 'real' || parsed.mode === 'designer')) {
        setState({ ...REAL, ...parsed, designerRoles: parsed.designerRoles ?? [] });
      }
    } catch {
      // storage corrupto: ignorar
    }
  }, []);

  // Persistir cambios — solo para cuentas dev (no ensuciar el storage del resto).
  useEffect(() => {
    if (typeof window === 'undefined' || !isDev) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, isDev]);

  const enterDesignerView = useCallback((designer: Designer) => {
    setState({
      mode: 'designer',
      designerId: designer.id,
      designerName: designer.displayName,
      designerRoles: designer.roles,
    });
  }, []);

  const exitToManager = useCallback(() => {
    setState(REAL);
  }, []);

  // Solo dev puede simular; en cualquier otro caso, identidad real.
  const simulating = isDev && state.mode === 'designer' && !!state.designerId;

  // Identidad EFECTIVA inyectada en el AuthContext para todos los consumidores.
  // Es un disfraz de solo frontend: servidor y RLS siguen viendo la cuenta real.
  const effectiveAuth = useMemo(() => {
    if (!simulating || !realUser) return auth;
    const profile: Profile = {
      id: state.designerId!,
      given_name: state.designerName ?? 'Diseñador',
      family_name: null,
      alias: null,
      full_name: state.designerName ?? 'Diseñador',
      display_name: state.designerName ?? 'Diseñador',
      kind: 'AGENCIA',
      roles: state.designerRoles,
      avatar_url: undefined,
    };
    return {
      ...auth,
      user: { ...realUser, id: state.designerId! },
      profile,
      access: deriveAccess(profile),
    };
  }, [auth, simulating, realUser, state.designerId, state.designerName, state.designerRoles]);

  const viewAsValue = useMemo<ViewAsContextValue>(
    () => ({
      isDev,
      simulating,
      simulatedDesignerId: simulating ? state.designerId : null,
      simulatedDesignerName: simulating ? state.designerName : null,
      enterDesignerView,
      exitToManager,
      realName: realProfile?.full_name ?? null,
      realDisplayName: realProfile?.display_name ?? null,
      realEmail: realUser?.email ?? null,
      realProfile,
      realViewMode: viewModeFor(realProfile),
      realAvatarUrl: realProfile?.avatar_url ?? null,
    }),
    [isDev, simulating, state.designerId, state.designerName, enterDesignerView, exitToManager, realProfile, realUser?.email]
  );

  return (
    <AuthContext.Provider value={effectiveAuth}>
      <ViewAsContext.Provider value={viewAsValue}>{children}</ViewAsContext.Provider>
    </AuthContext.Provider>
  );
}

export const useViewAs = () => useContext(ViewAsContext);
