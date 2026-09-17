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
  /** Nombre del rol que da la invitación («Diseñador senior»). */
  roleName: string | null;
}

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
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

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

      setInvitation({ id: row.id, roleName: row.role_name ?? null });
      setLoading(false);
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;

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

      // El rol se aplica server-side dentro de use_invitation(), nunca se pasa desde el cliente.
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            given_name: givenName.trim(),
            family_name: familyName.trim() || null,
            alias: alias.trim() || null,
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

      setTimeout(() => {
        router.push('/login');
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
          Rol: {invitation?.roleName ?? 'Miembro'}
        </Badge>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
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
            value={password}
            onChange={setPassword}
            disabled={submitting}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">Mínimo 6 caracteres.</p>
        </div>

        <AuthSubmitButton loading={submitting} loadingLabel="Creando cuenta...">
          Crear Cuenta
        </AuthSubmitButton>
      </form>
    </div>
  );
}
