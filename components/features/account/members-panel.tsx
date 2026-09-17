'use client';

/**
 * Panel de Miembros (dentro de Ajustes) — lenguaje del concepto D.
 * Tarjetas del equipo (clic → popup) e invitar. Lo ve quien invita compañeros o
 * gestiona roles.
 *
 * Acciones sobre un miembro:
 * - Renombrar: a la vista (acción normal).
 * - Cambiar rol / Eliminar: en "Zona avanzada" (plegada) — acciones extraordinarias,
 *   siempre con confirmación, solo con `gestionar_roles`. El rol se elige de la
 *   lista fija (un rol por persona; la tabla admite varios para cuando lleguen
 *   los agentes). Eliminar conserva los diseños del usuario.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Trash2, ChevronDown, ShieldAlert, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { SPRINGS, TWEENS, STAGGER } from '@/components/ui/animations';
import { Collapse } from '@/components/ui/collapse';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/user-avatar';
import { roleBadgeLabel, VIEW_MODE_ACCENT, viewModeFor } from '@/lib/utils/access';
import { useAuth } from '@/lib/auth/auth-context';
import { createClient } from '@/lib/supabase/client';
import { useUsersData, type Member } from '@/lib/hooks/use-users-data';
import { useRoles } from '@/lib/hooks/use-roles';
import { CreateInvitationDialog } from '@/components/invitations/create-invitation-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const rise = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: SPRINGS.gentle },
};

export function MembersPanel() {
  const { profile, access } = useAuth();
  const { users, mutate } = useUsersData();
  const { roles } = useRoles();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [givenDraft, setGivenDraft] = useState('');
  const [familyDraft, setFamilyDraft] = useState('');
  const [aliasDraft, setAliasDraft] = useState('');
  const [roleDraft, setRoleDraft] = useState<string>('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [busy, setBusy] = useState<null | 'save' | 'roles' | 'delete'>(null);
  const [confirmRole, setConfirmRole] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isSelf = member?.id === profile?.id;
  const currentRoleId = member?.roles[0]?.id ?? '';
  const draftRoleName = roles.find((r) => r.id === roleDraft)?.name ?? '';

  const openMember = (m: Member) => {
    setMember(m);
    setGivenDraft(m.given_name || '');
    setFamilyDraft(m.family_name || '');
    setAliasDraft(m.alias || '');
    setRoleDraft(m.roles[0]?.id ?? '');
    setAdvancedOpen(false);
  };

  const closeMember = () => {
    setMember(null);
    setAdvancedOpen(false);
  };

  const patchUser = async (payload: {
    given_name?: string;
    family_name?: string | null;
    alias?: string | null;
    role_ids?: string[];
  }) => {
    if (!member) return false;
    const res = await fetch(`/api/users/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'No se pudo actualizar');
    }
    return true;
  };

  const handleSaveName = async () => {
    if (!member) return;
    const given = givenDraft.trim();
    const family = familyDraft.trim();
    const alias = aliasDraft.trim();
    if (!given) {
      toast.error('El nombre no puede estar vacío');
      return;
    }
    const unchanged =
      given === (member.given_name || '') &&
      family === (member.family_name || '') &&
      alias === (member.alias || '');
    if (unchanged) {
      closeMember();
      return;
    }
    setBusy('save');
    try {
      await patchUser({ given_name: given, family_name: family || null, alias: alias || null });
      toast.success('Nombre actualizado');
      mutate();
      closeMember();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar');
    } finally {
      setBusy(null);
    }
  };

  const handleSaveRole = async () => {
    if (!member || !roleDraft) return;
    setBusy('roles');
    try {
      await patchUser({ role_ids: [roleDraft] });
      toast.success('Rol actualizado');
      mutate();
      setConfirmRole(false);
      closeMember();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el rol');
      setConfirmRole(false);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!member) return;
    setBusy('delete');
    try {
      const supabase = createClient();
      const { error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: member.id },
      });
      if (error) throw error;
      toast.success('Usuario eliminado. Sus diseños se conservan marcados como «exmiembro».');
      mutate();
      setConfirmDelete(false);
      closeMember();
    } catch (e) {
      // supabase.functions.invoke envuelve el error; el cuerpo real ({ error }) viene en context.
      let msg = 'No se pudo eliminar el usuario';
      if (e && typeof e === 'object' && 'context' in e) {
        try {
          const body = await (e as { context: Response }).context.json();
          if (body?.error) msg = body.error as string;
        } catch {
          /* cuerpo no-JSON: nos quedamos con el mensaje genérico */
        }
      } else if (e instanceof Error) {
        msg = e.message;
      }
      toast.error(msg);
      setConfirmDelete(false);
    } finally {
      setBusy(null);
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: STAGGER } } }}
      className="space-y-4"
    >
      <motion.div variants={rise} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {users.map((m) => {
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => openMember(m)}
              className="rounded-2xl border border-border bg-card p-lg text-left shadow-raised outline-none transition-colors hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UserAvatar
                name={m.full_name}
                src={m.avatar_url}
                className="h-12 w-12"
                fallbackClassName={cn('font-mono text-base font-semibold', VIEW_MODE_ACCENT[viewModeFor(m)])}
              />
              <p className="mt-3 truncate font-heading text-base font-semibold">
                {m.full_name || 'Sin nombre'}
              </p>
              <span
                className={cn(
                  'mt-3 inline-block rounded-full px-2.5 py-1 text-[11px] md:text-[10px] font-semibold uppercase tracking-wider',
                  VIEW_MODE_ACCENT[viewModeFor(m)]
                )}
              >
                {roleBadgeLabel(m)}
              </span>
            </button>
          );
        })}

        {access.can('invitar_personal') && (
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Plus className="h-6 w-6" />
            <span className="text-sm font-medium">Invitar miembro</span>
          </button>
        )}
      </motion.div>

      <CreateInvitationDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreated={() => mutate()}
      />

      {/* ───── Popup de acciones sobre un miembro ───── */}
      <AnimatePresence>
        {member && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={TWEENS.base}
              onClick={closeMember}
              className="glass-scrim fixed inset-0 z-50"
            />
            <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={SPRINGS.smooth}
                className="pointer-events-auto max-h-full w-full max-w-sm overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card shadow-overlay"
              >
                <div className="flex items-start justify-between p-lg pb-0">
                  <UserAvatar
                    name={member.full_name}
                    src={member.avatar_url}
                    className="h-12 w-12"
                    fallbackClassName={cn('font-mono text-base font-semibold', VIEW_MODE_ACCENT[viewModeFor(member)])}
                  />
                  <button
                    type="button"
                    onClick={closeMember}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground md:h-8 md:w-8"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4 p-lg">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-eyebrow text-muted-foreground">
                        Nombre
                      </label>
                      <input
                        value={givenDraft}
                        onChange={(e) => setGivenDraft(e.target.value)}
                        className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-4 text-base focus:outline-none md:text-sm focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="text-eyebrow text-muted-foreground">
                        Primer apellido
                      </label>
                      <input
                        value={familyDraft}
                        onChange={(e) => setFamilyDraft(e.target.value)}
                        className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-4 text-base focus:outline-none md:text-sm focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-eyebrow text-muted-foreground">
                      Alias <span className="normal-case text-muted-foreground/60">(opcional)</span>
                    </label>
                    <input
                      value={aliasDraft}
                      onChange={(e) => setAliasDraft(e.target.value)}
                      placeholder={givenDraft || 'Nombre para mostrar'}
                      className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-4 text-base focus:outline-none md:text-sm focus:ring-2 focus:ring-ring"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Si lo rellenas, se mostrará en vez del nombre.
                    </p>
                  </div>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] md:text-[10px] font-semibold uppercase tracking-wider',
                        VIEW_MODE_ACCENT[viewModeFor(member)]
                      )}
                    >
                      {roleBadgeLabel(member)}
                    </span>
                    Se unió el {format(new Date(member.created_at), 'dd/MM/yyyy')}
                  </p>

                  {/* Zona avanzada: rol + eliminar (extraordinario). Oculta para uno mismo y para quien no gestiona roles. */}
                  {!isSelf && access.can('gestionar_roles') && (
                    <div className="rounded-xl border border-border/60">
                      <button
                        type="button"
                        onClick={() => setAdvancedOpen((v) => !v)}
                        className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 md:min-h-0"
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span className="flex-1">Zona avanzada</span>
                        <motion.span
                          initial={false}
                          animate={{ rotate: advancedOpen ? 0 : -90 }}
                          transition={SPRINGS.snappy}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </motion.span>
                      </button>
                      <Collapse open={advancedOpen}>
                        <div className="space-y-3 px-3 pb-3 pt-1">
                          <p className="text-eyebrow text-muted-foreground">Rol</p>
                          <Select value={roleDraft} onValueChange={setRoleDraft}>
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
                          <button
                            type="button"
                            onClick={() => setConfirmRole(true)}
                            disabled={!roleDraft || roleDraft === currentRoleId}
                            className="flex h-11 w-full items-center justify-center rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-50 md:h-9"
                          >
                            Cambiar rol
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(true)}
                            className="flex h-11 w-full items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 md:h-9"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Eliminar usuario
                          </button>
                        </div>
                      </Collapse>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-border/60 p-lg pt-md">
                  <button
                    type="button"
                    onClick={closeMember}
                    className="flex h-11 items-center rounded-xl px-4 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground md:h-9"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveName}
                    disabled={busy === 'save'}
                    className="flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 md:h-9"
                  >
                    {busy === 'save' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Guardar
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmRole}
        onOpenChange={(o) => !o && setConfirmRole(false)}
        onConfirm={handleSaveRole}
        title={`¿Cambiar el rol a ${draftRoleName}?`}
        description={`${member?.full_name || 'Este usuario'} pasará a tener los permisos de ese rol y dejará de tener los del actual.`}
        confirmLabel="Cambiar rol"
        variant="warning"
        loading={busy === 'roles'}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="¿Eliminar usuario?"
        description={`${member?.full_name || 'Este usuario'} perderá el acceso al panel. Sus diseños se conservan y quedarán marcados como «exmiembro». No se puede deshacer.`}
        confirmLabel="Eliminar usuario"
        variant="danger"
        loading={busy === 'delete'}
      />
    </motion.div>
  );
}
