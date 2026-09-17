'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AuthHeading } from '@/components/features/auth/auth-heading';
import { AuthError } from '@/components/features/auth/auth-error';
import { AuthSubmitButton } from '@/components/features/auth/auth-submit-button';
import { PasswordInput } from '@/components/features/auth/password-input';
import { homeFor, toProfile, PROFILE_WITH_ROLES_SELECT, viewModeFor } from '@/lib/utils/access';

type Mode = 'login' | 'reset';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<Mode>('login');
  const [resetSent, setResetSent] = useState(false);

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError(
          authError.message === 'Invalid login credentials'
            ? 'Email o contraseña incorrectos'
            : authError.message
        );
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(PROFILE_WITH_ROLES_SELECT)
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        setError('Usuario sin perfil configurado. Contacta al administrador.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      window.location.href = homeFor(viewModeFor(toProfile(profile)));
    } catch {
      setError('Error al iniciar sesión. Intenta de nuevo.');
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setResetSent(true);
    } catch {
      setError('Error al enviar el email. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setResetSent(false);
  };

  if (mode === 'reset') {
    return (
      <div>
        <button
          onClick={() => switchMode('login')}
          className="mb-6 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio de sesión
        </button>

        <AuthHeading
          title="Recuperar contraseña"
          subtitle="Te enviaremos un enlace para restablecer tu contraseña"
        />

        {resetSent ? (
          <div className="rounded-lg border border-status-success/50 bg-status-success/10 p-4 text-status-success">
            <div className="mb-2 flex items-center gap-2">
              <Mail className="h-5 w-5" />
              <span className="font-medium">Email enviado</span>
            </div>
            <p className="text-sm">
              Revisa tu bandeja de entrada en <strong>{email}</strong> y sigue las instrucciones para restablecer tu contraseña.
            </p>
            <p className="mt-2 text-sm opacity-90">Si no lo encuentras, revisa tu carpeta de spam.</p>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleResetPassword}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="h-11"
              />
            </div>

            <AuthError message={error} />

            <AuthSubmitButton loading={loading} loadingLabel="Enviando..." disabled={!email}>
              Enviar enlace de recuperación
            </AuthSubmitButton>
          </form>
        )}
      </div>
    );
  }

  return (
    <div>
      <AuthHeading title="Iniciar Sesión" subtitle="Accede a tu cuenta de PHSPORT" />

      <form className="space-y-5" onSubmit={handleLogin}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <button
              type="button"
              onClick={() => switchMode('reset')}
              className="text-sm text-primary transition-colors hover:text-primary/80"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            required
            disabled={loading}
          />
        </div>

        <AuthError message={error} />

        <AuthSubmitButton loading={loading} loadingLabel="Iniciando sesión...">
          Iniciar Sesión
        </AuthSubmitButton>
      </form>
    </div>
  );
}
