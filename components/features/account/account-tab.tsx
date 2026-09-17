'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera } from 'lucide-react';
import { AvatarUploadDialog } from './avatar-upload-dialog';

interface AccountTabProps {
  givenName: string;
  onGivenNameChange: (v: string) => void;
  familyName: string;
  onFamilyNameChange: (v: string) => void;
  alias: string;
  onAliasChange: (v: string) => void;
  email: string | undefined;
  /** Nombres de los roles, ya escritos para enseñar («Gestor creativo»). */
  roleLabel: string;
  avatarUrl: string | null | undefined;
  uploading: boolean;
  /** Sube el JPEG recortado/comprimido. Devuelve true si tuvo éxito. */
  onAvatarConfirm: (blob: Blob) => Promise<boolean>;
}

export function AccountTab({
  givenName,
  onGivenNameChange,
  familyName,
  onFamilyNameChange,
  alias,
  onAliasChange,
  email,
  roleLabel,
  avatarUrl,
  uploading,
  onAvatarConfirm,
}: AccountTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Permitir volver a elegir el mismo fichero más tarde.
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona un archivo de imagen (JPG o PNG).');
      return;
    }
    setSelectedFile(file);
    setDialogOpen(true);
  };

  const handleConfirm = async (blob: Blob) => {
    const ok = await onAvatarConfirm(blob);
    if (ok) {
      setDialogOpen(false);
      setSelectedFile(null);
    }
  };

  const displayName = alias.trim() || givenName.trim() || email?.split('@')[0];

  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
          <UserAvatar
            name={displayName}
            src={avatarUrl}
            className="h-24 w-24 border-2 border-border group-hover:border-primary transition-colors"
            fallbackClassName="text-2xl font-bold bg-primary/10 text-primary"
          />
          <div className="absolute inset-0 hidden rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 md:flex items-center justify-center">
            <Camera className="h-6 w-6 text-white" />
          </div>
          {/* Táctil: el hover no existe — badge de cámara siempre visible (patrón WhatsApp). */}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground md:hidden">
            <Camera className="h-4 w-4" />
          </span>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">Haz clic para cambiar tu foto</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="givenName">Nombre</Label>
            <Input
              id="givenName"
              value={givenName}
              onChange={(e) => onGivenNameChange(e.target.value)}
              placeholder="Tu nombre"
              className="bg-background border-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="familyName">Primer apellido</Label>
            <Input
              id="familyName"
              value={familyName}
              onChange={(e) => onFamilyNameChange(e.target.value)}
              placeholder="Tu apellido"
              className="bg-background border-input"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="alias">Alias (opcional)</Label>
          <Input
            id="alias"
            value={alias}
            onChange={(e) => onAliasChange(e.target.value)}
            placeholder={givenName || 'Cómo quieres que te muestren'}
            className="bg-background border-input"
          />
          <p className="text-xs text-muted-foreground">
            Si lo rellenas, se mostrará en vez de tu nombre.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={email || ''}
            disabled
            className="bg-muted text-muted-foreground border-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Rol</Label>
          <Input
            id="role"
            value={roleLabel}
            disabled
            className="bg-muted text-muted-foreground border-input"
          />
        </div>
      </div>

      <AvatarUploadDialog
        file={selectedFile}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedFile(null);
        }}
        onConfirm={handleConfirm}
        uploading={uploading}
      />
    </div>
  );
}
