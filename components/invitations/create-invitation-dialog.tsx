'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/lib/utils/logger';
import { useRoles } from '@/lib/hooks/use-roles';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Copy, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface CreateInvitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateInvitationDialog({ 
  open, 
  onOpenChange,
  onCreated 
}: CreateInvitationDialogProps) {
  const { roles } = useRoles();
  const [roleId, setRoleId] = useState<string>('');
  const [creating, setCreating] = useState(false);

  // Por defecto, «Diseñador» (el rol de quien entra a hacer diseños); si no
  // existiera, el primero del catálogo.
  useEffect(() => {
    if (!roleId && roles.length) {
      setRoleId(roles.find((r) => r.name === 'Diseñador')?.id ?? roles[0].id);
    }
  }, [roles, roleId]);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    let token = '';
    for (let i = 0; i < 16; i++) {
      token += chars.charAt(bytes[i] % chars.length);
    }
    return token;
  };

  const handleCreate = async () => {
    if (!roleId) {
      toast.error('Elige un rol');
      return;
    }
    setCreating(true);

    try {
      const supabase = createClient();
      const token = generateToken();
      
      // Caducidad corta: 24h, 1 uso (evita invitaciones "flotando")
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // `role_id` es el rol de verdad; la columna antigua `role` se queda en su
      // valor por defecto hasta que la migración 046 la retire. `created_by` lo
      // pone la base.
      const { error } = await supabase
        .from('invitations')
        .insert({
          token,
          role_id: roleId,
          max_uses: 1,
          expires_at: expiresAt.toISOString(),
        });

      if (error) {
        toast.error('Error al crear la invitación');
        logger.error('Error creating invitation:', error);
        setCreating(false);
        return;
      }

      setCreatedToken(token);
      
      // Auto-copy to clipboard
      const url = `${window.location.origin}/invite/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success('¡Invitación creada y copiada al portapapeles!');
      } catch {
        toast.success('Invitación creada');
      }
      
      onCreated();
    } catch {
      toast.error('Error al crear la invitación');
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!createdToken) return;
    
    const url = `${window.location.origin}/invite/${createdToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copiado');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Error al copiar');
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setCreatedToken(null);
      setCopied(false);
      setRoleId('');
    }
    onOpenChange(open);
  };

  const getInviteUrl = () => {
    if (!createdToken || typeof window === 'undefined') return '';
    return `${window.location.origin}/invite/${createdToken}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {createdToken ? '¡Link creado!' : 'Nueva Invitación'}
          </DialogTitle>
          <DialogDescription>
            {createdToken 
              ? 'El link ha sido copiado al portapapeles.'
              : 'La invitación expira en 24 horas y es de un solo uso.'}
          </DialogDescription>
        </DialogHeader>

        {createdToken ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Input 
                value={getInviteUrl()} 
                readOnly 
                className="flex-1 font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyToClipboard}
                aria-label={copied ? 'Link copiado' : 'Copiar link de invitación'}
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-status-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elige un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          {createdToken ? (
            <Button onClick={() => handleClose(false)} className="w-full">
              Cerrar
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear y Copiar'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
