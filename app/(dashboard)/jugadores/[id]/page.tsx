'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  Link2,
  Loader2,
  Share2,
  ShieldAlert,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Collapse } from '@/components/ui/collapse';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DashboardPage } from '@/components/ui/dashboard-page';
import { RowSeparator } from '@/components/ui/row';
import { SPRINGS } from '@/components/ui/animations';
import { PlayerDetailSkeleton } from '@/components/skeletons/player-detail-skeleton';
import { Section } from '@/components/features/players/section';
import { useAuth } from '@/lib/auth/auth-context';
import { homeFor, viewModeFor } from '@/lib/utils/access';
import { usePlayer, usePlayerFiles } from '@/lib/hooks/use-player';
import { createClient } from '@/lib/supabase/client';
import { inviteUrl } from '@/lib/services/invitations/token';
import { createPlayerInvitation, deletePlayer, updatePlayer } from '@/lib/services/players/player';
import { expiresInLabel, FOLDERS, folderCounts, folderLabel, SENT } from '@/lib/utils/players';
import { logger } from '@/lib/utils/logger';
import { cn } from '@/lib/utils';

/**
 * La ficha (spec §8): su acceso, sus carpetas y la puerta a una entrega.
 * Existe antes que la cuenta; el enlace nace aquí y al aceptarlo la cuenta
 * queda enganchada a esta ficha sola.
 */
export default function PlayerDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { profile, access, status } = useAuth();
  const authLoading = status === 'INITIALIZING';
  const allowed = access.inDepartment('creativo');
  const { player, isLoading, mutate } = usePlayer(allowed ? id : null);
  const { files } = usePlayerFiles(allowed ? id : null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!authLoading && profile && !allowed) router.replace(homeFor(viewModeFor(profile)));
  }, [authLoading, profile, allowed, router]);

  if (!authLoading && profile && !allowed) return null;

  const showSkeleton = authLoading || (isLoading && !player);
  const counts = folderCounts(files);

  return (
    <DashboardPage
      title={player?.full_name ?? 'Jugador'}
      icon={Users}
      subtitle={player && !player.active ? 'Inactivo: no aparece como disponible, pero conserva sus archivos.' : undefined}
      skeleton={<PlayerDetailSkeleton />}
      loading={showSkeleton}
      maxWidth="2xl"
    >
      <div className="-mt-2">
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href="/jugadores">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Jugadores
          </Link>
        </Button>
      </div>

      {!player ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Esta ficha no existe o se ha borrado.</p>
      ) : (
        <div className="space-y-6">
          <AccountSection
            playerId={player.id}
            account={player.account}
            invite={player.invite}
            now={now}
            onChanged={() => {
              setNow(new Date());
              mutate();
            }}
          />

          <Section label="Carpetas" hint="Lo que se le ha entregado y lo que él manda" padded={false}>
            <ul>
              {[...FOLDERS, SENT].map((view, i) => (
                <li key={view}>
                  {i > 0 && <RowSeparator />}
                  <Link
                    href={`/jugadores/${player.id}/${view}`}
                    className="flex min-h-14 items-center justify-between gap-3 px-4 py-2 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    <span className="text-[15px]">{view === SENT ? 'Enviados por él' : folderLabel(view)}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono tabular text-xs text-muted-foreground">
                        {counts[view]} {counts[view] === 1 ? 'archivo' : 'archivos'}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Button asChild size="lg" className="h-11 w-full">
            <Link href={`/jugadores/${player.id}/entrega`}>
              <Upload className="mr-2 h-4 w-4" />
              Nueva entrega
            </Link>
          </Button>

          <AdvancedZone
            player={player}
            onSaved={() => mutate()}
            onDeleted={() => router.replace('/jugadores')}
          />
        </div>
      )}
    </DashboardPage>
  );
}

// ─── Cuenta y enlace ──────────────────────────────────────────

function AccountSection({
  playerId,
  account,
  invite,
  now,
  onChanged,
}: {
  playerId: string;
  account: { display_name: string; created_at: string } | null;
  invite: { token: string; expires_at: string | null } | null;
  now: Date;
  onChanged: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const left = invite?.expires_at ? expiresInLabel(invite.expires_at, now) : null;
  const liveInvite = invite && left ? invite : null;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const create = async () => {
    setCreating(true);
    try {
      await createPlayerInvitation(createClient(), playerId);
      toast.success('Enlace creado. Cópialo o compártelo desde aquí.');
      onChanged();
    } catch (e) {
      logger.error('Error creating player invitation:', e);
      toast.error(e instanceof Error ? e.message : 'No se pudo crear el enlace');
    } finally {
      setCreating(false);
    }
  };

  const copy = async () => {
    if (!liveInvite) return;
    try {
      await navigator.clipboard.writeText(inviteUrl(liveInvite.token));
      toast.success('Enlace copiado');
    } catch {
      toast.error('No se pudo copiar; compártelo o cópialo a mano');
    }
  };

  const share = async () => {
    if (!liveInvite) return;
    try {
      await navigator.share({ title: 'Tu área personal en PHSPORT', url: inviteUrl(liveInvite.token) });
    } catch {
      // Cancelar la hoja de compartir no es un error.
    }
  };

  return (
    <Section label="Cuenta" hint="Su acceso al área personal">
      {account ? (
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px]">Con cuenta · {account.display_name}</span>
          <span className="font-mono tabular text-xs text-muted-foreground">
            desde el {format(new Date(account.created_at), "d 'de' MMMM", { locale: es })}
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[15px]">Sin cuenta todavía</span>
              <span className="font-mono tabular text-xs text-muted-foreground">
                {liveInvite ? `Enlace creado · caduca en ${left}` : 'Sin enlace vivo'}
              </span>
            </span>
            {!liveInvite && (
              <Button variant="outline" size="sm" onClick={create} disabled={creating} className="shrink-0">
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                Crear enlace
              </Button>
            )}
          </div>
          {liveInvite && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copy}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar enlace
              </Button>
              {canShare && (
                <Button variant="outline" size="sm" onClick={share}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Compartir
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={create} disabled={creating} className="text-muted-foreground">
                Nuevo enlace
              </Button>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

// ─── Zona avanzada ────────────────────────────────────────────

function AdvancedZone({
  player,
  onSaved,
  onDeleted,
}: {
  player: { id: string; given_name: string; family_name: string | null; active: boolean; full_name: string };
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [givenName, setGivenName] = useState(player.given_name);
  const [familyName, setFamilyName] = useState(player.family_name ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty = givenName.trim() !== player.given_name || (familyName.trim() || null) !== (player.family_name ?? null);

  const save = async () => {
    if (!givenName.trim()) {
      toast.error('El nombre no puede quedar vacío');
      return;
    }
    setSaving(true);
    try {
      await updatePlayer(createClient(), player.id, {
        given_name: givenName.trim(),
        family_name: familyName.trim() || null,
      });
      toast.success('Ficha guardada');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (active: boolean) => {
    try {
      await updatePlayer(createClient(), player.id, { active });
      toast.success(active ? 'Ficha activa' : 'Ficha inactiva');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar');
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await deletePlayer(createClient(), player.id);
      toast.success('Ficha borrada');
      setConfirmDelete(false);
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo borrar');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 md:min-h-0"
      >
        <ShieldAlert className="h-3.5 w-3.5" />
        <span className="flex-1">Zona avanzada</span>
        <motion.span initial={false} animate={{ rotate: open ? 0 : -90 }} transition={SPRINGS.snappy}>
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>
      <Collapse open={open}>
        <div className="space-y-4 px-3 pb-3 pt-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="player-given">Nombre</Label>
              <Input id="player-given" value={givenName} onChange={(e) => setGivenName(e.target.value)} disabled={saving} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="player-family">Apellidos</Label>
              <Input id="player-family" value={familyName} onChange={(e) => setFamilyName(e.target.value)} disabled={saving} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={!dirty || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar nombre
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Activo</span>
              <span className="text-xs text-muted-foreground">Inactivo no borra nada; solo lo marca.</span>
            </span>
            <Switch checked={player.active} onCheckedChange={toggleActive} aria-label="Ficha activa" />
          </div>

          <div className="border-t border-border/60 pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className={cn('text-destructive hover:bg-destructive/10 hover:text-destructive')}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar ficha
            </Button>
          </div>
        </div>
      </Collapse>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={remove}
        loading={deleting}
        variant="danger"
        title={`¿Borrar la ficha de ${player.full_name}?`}
        description="Se borran sus archivos y sus enlaces. Si ya tiene cuenta, la cuenta se queda pero sin área personal."
        confirmLabel="Borrar ficha"
      />
    </div>
  );
}
