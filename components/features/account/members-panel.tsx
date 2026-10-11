'use client';

/**
 * Panel de Miembros (dentro de Ajustes) — lenguaje del concepto D.
 * Tarjetas del equipo (clic → popup) e invitar. Lo ve quien invita o reparte
 * roles en algún departamento, y solo ve a la gente de esos departamentos
 * (`membersVisibleTo`): un director ve únicamente a Agentes.
 *
 * Acciones sobre un miembro:
 * - Renombrar: a la vista (acción normal), solo con `gestionar_roles`; sin él
 *   los campos quedan de solo lectura.
 * - Cambiar rol / Eliminar: en "Zona avanzada" (plegada) — acciones extraordinarias,
 *   siempre con confirmación. El rol se elige POR DEPARTAMENTO (un rol por
 *   persona y departamento) y solo en los que esta cuenta puede repartir
 *   (`departmentsManagedBy`): quien solo reparte en Agentes no ve el selector
 *   de creativo. Eliminar conserva los diseños del usuario y sigue siendo solo
 *   de quien gestiona roles.
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
import {
  departmentsInvitableBy,
  departmentsManagedBy,
  membersVisibleTo,
  roleBadgeLabel,
  VIEW_MODE_ACCENT,
  viewModeFor,
  type Department,
} from '@/lib/utils/access';
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
  const { users: allUsers, mutate } = useUsersData();
  const users = membersVisibleTo(allUsers, access);
  const managed = departmentsManagedBy(access);
  const canRename = access.can('gestionar_roles');
  const { roles } = useRoles();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [givenDraft, setGivenDraft] = useState('');
  const [familyDraft, setFamilyDraft] = useState('');
  const [aliasDraft, setAliasDraft] = useState('');
  // Un borrador de rol por departamento: Mario puede tener uno de creativo y
  // otro de Agentes, y cambiar uno no toca el otro.
  const [roleDrafts, setRoleDrafts] = useState<Partial<Record<Department, string>>>({});
  const [confirmDept, setConfirmDept] = useState<Department | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [busy, setBusy] = useState<null | 'save' | 'roles' | 'delete'>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isSelf = member?.id === profile?.id;
  const currentRoleIn = (m: Member | null, d: Department) => m?.roles.find((r) => r.department === d)?.id ?? '';
  const draftRoleName = confirmDept
    ? roles.find((r) => r.id === roleDrafts[confirmDept])?.name ?? ''
    : '';

  const openMember = (m: Member) => {
    setMember(m);
    setGivenDraft(m.given_name || '');
    setFamilyDraft(m.family_name || '');
    setAliasDraft(m.alias || '');
    setRoleDrafts(Object.fromEntries(managed.map((d) => [d, currentRoleIn(m, d)])));
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
    department_role?: { department: Department; role_id: string };
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
    const roleId = confirmDept ? roleDrafts[confirmDept] : undefined;
    if (!member || !confirmDept || !roleId) return;
    setBusy('roles');
    try {
      await patchUser({ department_role: { department: confirmDept, role_id: roleId } });
      toast.success('Rol actualizado');
      mutate();
      setConfirmDept(null);
      closeMember();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el rol');
      setConfirmDept(null);
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

        {departmentsInvitableBy(access).length > 0 && (
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
                        disabled={!canRename}
                        className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-4 text-base focus:outline-none md:text-sm focus:ring-2 focus:ring-ring disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="text-eyebrow text-muted-foreground">
                        Primer apellido
                      </label>
                      <input
                        value={familyDraft}
                        onChange={(e) => setFamilyDraft(e.target.value)}
                        disabled={!canRename}
                        className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-4 text-base focus:outline-none md:text-sm focus:ring-2 focus:ring-ring disabled:opacity-60"
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
                      disabled={!canRename}
                      placeholder={givenDraft || 'Nombre para mostrar'}
                      className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-4 text-base focus:outline-none md:text-sm focus:ring-2 focus:ring-ring disabled:opacity-60"
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

                  {/* Zona avanzada: rol + eliminar (extraordinario). Oculta para uno mismo y para quien no reparte roles en ningún departamento. */}
                  {!isSelf && managed.length > 0 && (
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
                          {managed.map((d) => {
                            const options = roles.filter((r) => r.department === d);
                            const draft = roleDrafts[d] ?? '';
                            return (
                              <div key={d} className="space-y-2">
                                <p className="text-eyebrow text-muted-foreground">
                                  {d === 'creativo' ? 'Rol en creativo' : 'Rol en Agentes'}
                                </p>
                                <Select
                                  value={draft}
                                  onValueChange={(v) => setRoleDrafts((prev) => ({ ...prev, [d]: v }))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Sin rol" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {options.map((r) => (
                                      <SelectItem key={r.id} value={r.id}>
                                        {r.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDept(d)}
                                  disabled={!draft || draft === currentRoleIn(member, d)}
                                  className="flex h-11 w-full items-center justify-center rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-50 md:h-9"
                                >
                                  Cambiar rol
                                </button>
                              </div>
                            );
                          })}
                          {access.can('gestionar_roles') && (
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(true)}
                              className="flex h-11 w-full items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 md:h-9"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Eliminar usuario
                            </button>
                          )}
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
                  {/* Renombrar exige gestionar_roles en la API; sin él, el botón solo devolvía un error. */}
                  {canRename && (
                    <button
                      type="button"
                      onClick={handleSaveName}
                      disabled={busy === 'save'}
                      className="flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 md:h-9"
                    >
                      {busy === 'save' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Guardar
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Con dos departamentos, «dejará de tener los del actual» solo es cierto si
          ya tenía rol en ESE departamento; si no, conserva el del otro y suma este. */}
      <ConfirmDialog
        open={confirmDept !== null}
        onOpenChange={(o) => !o && setConfirmDept(null)}
        onConfirm={handleSaveRole}
        title={`¿Cambiar el rol a ${draftRoleName}?`}
        description={`${member?.full_name || 'Este usuario'} ${
          confirmDept && !currentRoleIn(member, confirmDept)
            ? 'conservará lo que ya tiene y sumará los permisos de ese rol.'
            : 'pasará a tener los permisos de ese rol y dejará de tener los de su rol actual en ese departamento.'
        }`}
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
