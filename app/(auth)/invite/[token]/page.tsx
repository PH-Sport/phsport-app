'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/utils/logger';
import { AuthHeading } from '@/components/features/auth/auth-heading';
import { AuthSuccess } from '@/components/features/auth/auth-success';
import { AuthSubmitButton } from '@/components/features/auth/auth-submit-button';
import { PasswordInput } from '@/components/features/auth/password-input';

interface Invitation {
  id: string;
  /** Nombre del rol que da la invitación («Diseñador senior»); nulo si es de jugador. */
  roleName: string | null;
  /** La ficha a la que queda enganchada la cuenta; nulo si es de personal. */
  playerId: string | null;
  playerName: string | null;
}

/**
 * El alta por enlace. Una misma pantalla para dos casos (spec §8): la
 * invitación de personal da un rol; la de jugador engancha la cuenta a su
 * ficha, con el nombre ya puesto y un solo campo de apellidos. Cuál es cada
 * una lo dice la base, no la URL.
 */
export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [alias, setAlias] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const isPlayer = !!invitation?.playerId;

  useEffect(() => {
    const validateToken = async () => {
      const supabase = createClient();

      // Validación por token vía RPC SECURITY DEFINER: no expone la tabla
      // invitations a anon (evita enumeración de tokens/roles).
      const { data, error: fetchError } = await supabase.rpc('get_invitation_by_token', {
        p_token: token,
      });

      const row = Array.isArray(data) ? data[0] : null;

      if (fetchError || !row) {
        setError('Esta invitación no existe o ha sido eliminada.');
        setLoading(false);
        return;
      }

      if (!row.valid) {
        setError('Esta invitación ha expirado o ya ha sido utilizada.');
        setLoading(false);
        return;
      }

      setInvitation({
        id: row.id,
        roleName: row.role_name ?? null,
        playerId: row.player_id ?? null,
        playerName: row.player_name ?? null,
      });

      // La ficha ya tiene el nombre: se rellena y él lo corrige si hace falta.
      if (row.player_id && typeof row.player_name === 'string') {
        const [first, ...rest] = row.player_name.trim().split(/\s+/);
        setGivenName(first ?? '');
        setFamilyName(rest.join(' '));
      }
      setLoading(false);
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;

    if (isPlayer && password !== passwordAgain) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();

      const { data: isValid, error: validateError } = await supabase.rpc('validate_invitation', {
        p_invitation_id: invitation.id,
      });

      if (validateError || !isValid) {
        toast.error('Esta invitación ya no es válida. Puede que haya expirado o ya fue usada.');
        setSubmitting(false);
        return;
      }

      // El rol (o la ficha) se aplica server-side dentro de use_invitation(), nunca se pasa desde el cliente.
      // `kind` sí viaja: el perfil del jugador nace JUGADOR desde el primer segundo,
      // para que producción no lo tome por diseñador si use_invitation fallara.
      // Ponérselo sin invitación solo da una cuenta que no puede nada.
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            given_name: givenName.trim(),
            family_name: familyName.trim() || null,
            alias: isPlayer ? null : alias.trim() || null,
            ...(isPlayer ? { kind: 'JUGADOR' } : {}),
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          toast.error('Este email ya está registrado. Intenta iniciar sesión.');
        } else {
          toast.error(signUpError.message);
        }
        setSubmitting(false);
        return;
      }

      if (!authData.user) {
        toast.error('Error al crear la cuenta. Intenta de nuevo.');
        setSubmitting(false);
        return;
      }

      const { error: useError } = await supabase.rpc('use_invitation', {
        p_invitation_id: invitation.id,
        p_user_id: authData.user.id,
        p_email: email,
        p_full_name: `${givenName.trim()} ${familyName.trim()}`.trim(),
      });

      if (useError) {
        logger.error('Error using invitation:', useError);
        toast.error(useError.message || 'Esta invitación ya no es válida');
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      toast.success('¡Cuenta creada exitosamente!');

      // Si el alta abrió sesión, el cliente pudo leer el perfil ANTES de que
      // use_invitation lo marcara (jugador, roles): se queda con uno viejo y
      // el marco del jugador se pierde en redirecciones. Se cierra la sesión y
      // se recarga de verdad, como hace el login; el usuario entra limpio.
      setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.assign('/login');
      }, 2000);
    } catch {
      toast.error('Error al crear la cuenta. Intenta de nuevo.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">Invitación no válida</h1>
        <p className="mb-6 text-muted-foreground">{error}</p>
        <Button onClick={() => router.push('/login')} variant="outline">
          Ir al login
        </Button>
      </div>
    );
  }

  if (success) {
    return <AuthSuccess title="¡Cuenta creada!" description="Redirigiendo al login..." />;
  }

  return (
    <div>
      <AuthHeading title="Has sido invitado" subtitle="Crea tu cuenta en PHSPORT" />
      <div className="mb-8 -mt-4">
        <Badge variant="outline" className="text-sm">
          {isPlayer ? `Área personal · ${invitation?.playerName ?? ''}` : `Rol: ${invitation?.roleName ?? 'Miembro'}`}
        </Badge>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {isPlayer ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="givenName">Nombre</Label>
              <Input
                id="givenName"
                name="givenName"
                type="text"
                required
                placeholder="Tu nombre"
                value={givenName}
                onChange={(e) => setGivenName(e.target.value)}
                disabled={submitting}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="familyName">Apellidos</Label>
              <Input
                id="familyName"
                name="familyName"
                type="text"
                placeholder="Tus apellidos"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                disabled={submitting}
                className="h-11"
              />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="givenName">Nombre</Label>
                <Input
                  id="givenName"
                  name="givenName"
                  type="text"
                  required
                  placeholder="Tu nombre"
                  value={givenName}
                  onChange={(e) => setGivenName(e.target.value)}
                  disabled={submitting}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="familyName">Primer apellido</Label>
                <Input
                  id="familyName"
                  name="familyName"
                  type="text"
                  required
                  placeholder="Tu apellido"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  disabled={submitting}
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="alias">Alias (opcional)</Label>
              <Input
                id="alias"
                name="alias"
                type="text"
                placeholder={givenName || 'Cómo quieres que te muestren'}
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                disabled={submitting}
                className="h-11"
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">{isPlayer ? 'Correo' : 'Email'}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder={isPlayer ? 'tu@correo.com' : 'tu@email.com'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <PasswordInput
            id="password"
            name="password"
            required
            minLength={6}
            placeholder={isPlayer ? 'Mínimo 6 caracteres' : undefined}
            value={password}
            onChange={setPassword}
            disabled={submitting}
            className="h-11"
          />
          {!isPlayer && <p className="text-xs text-muted-foreground">Mínimo 6 caracteres.</p>}
        </div>

        {isPlayer && (
          <div className="space-y-2">
            <Label htmlFor="passwordAgain">Confirmar contraseña</Label>
            <PasswordInput
              id="passwordAgain"
              name="passwordAgain"
              required
              minLength={6}
              placeholder="Repite la contraseña"
              value={passwordAgain}
              onChange={setPasswordAgain}
              disabled={submitting}
              className="h-11"
            />
          </div>
        )}

        <AuthSubmitButton loading={submitting} loadingLabel="Creando cuenta...">
          Crear cuenta
        </AuthSubmitButton>
      </form>
    </div>
  );
}
