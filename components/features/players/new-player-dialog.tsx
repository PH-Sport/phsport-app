'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PostgrestError } from '@supabase/supabase-js';
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
import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/utils/logger';

interface NewPlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Con el id de la ficha recién creada, para saltar a ella. */
  onCreated: (id: string) => void;
}

/**
 * La ficha es lo mínimo (spec §8): nombre y apellidos. Existe antes que la
 * cuenta; el enlace se manda después, desde la ficha.
 */
export function NewPlayerDialog({ open, onOpenChange, onCreated }: NewPlayerDialogProps) {
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [saving, setSaving] = useState(false);

  const close = (next: boolean) => {
    if (!next) {
      setGivenName('');
      setFamilyName('');
    }
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const given = givenName.trim();
    if (!given) {
      toast.error('Escribe el nombre');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error }: { data: { id: string } | null; error: PostgrestError | null } = await supabase
      .from('players')
      .insert({ given_name: given, family_name: familyName.trim() || null })
      .select('id')
      .single();
    setSaving(false);
    if (error || !data) {
      logger.error('Error creating player:', error);
      toast.error('No se pudo crear la ficha');
      return;
    }
    toast.success('Ficha creada');
    close(false);
    onCreated(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo jugador</DialogTitle>
            <DialogDescription>
              Solo el nombre. El enlace para que entre se manda desde su ficha, cuando toque.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="player-given-name">Nombre</Label>
              <Input
                id="player-given-name"
                value={givenName}
                onChange={(e) => setGivenName(e.target.value)}
                placeholder="Juan"
                autoComplete="off"
                required
                disabled={saving}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="player-family-name">Apellidos</Label>
              <Input
                id="player-family-name"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="Cruz"
                autoComplete="off"
                disabled={saving}
                className="h-11"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando…
                </>
              ) : (
                'Crear ficha'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
