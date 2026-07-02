'use client';

import * as React from 'react';
import { Check, Loader2, LogOut, Pencil, ShieldCheck, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ConversationDTO } from '@fbclone/types';
import { ApiClientError } from '@/lib/api-client';
import { confirmDialog } from '@/stores/confirm-store';
import {
  useAddGroupMembers,
  useConversationMembers,
  useLeaveGroup,
  useRemoveGroupMember,
  useRenameGroup,
} from '@/hooks/use-chat';
import { useFriends } from '@/hooks/use-friends';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, fullName, initials } from '@/lib/utils';

/** WhatsApp-style group info: rename, view/add/remove members, leave. */
export function GroupInfoDialog({
  conversation,
  onClose,
  onLeft,
}: {
  conversation: ConversationDTO;
  onClose: () => void;
  onLeft: () => void;
}) {
  const convId = conversation.id;
  const isAdmin = conversation.myRole === 'ADMIN';
  const { data, isLoading } = useConversationMembers(convId, true);
  const members = data?.members ?? [];

  const rename = useRenameGroup(convId);
  const addMembers = useAddGroupMembers(convId);
  const removeMember = useRemoveGroupMember(convId);
  const leave = useLeaveGroup();

  const [editingName, setEditingName] = React.useState(false);
  const [name, setName] = React.useState(conversation.name ?? '');
  const [adding, setAdding] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const { data: friendsData } = useFriends();
  const memberIds = new Set(members.map((m) => m.id));
  const candidates = (friendsData?.friends ?? []).filter((f) => !memberIds.has(f.id));

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await rename.mutateAsync(trimmed);
      setEditingName(false);
      toast.success('Group renamed');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not rename group');
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const doAdd = async () => {
    if (selected.size === 0) return;
    try {
      await addMembers.mutateAsync([...selected]);
      setSelected(new Set());
      setAdding(false);
      toast.success('Members added');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not add members');
    }
  };

  const doRemove = async (userId: string, personName: string) => {
    const ok = await confirmDialog({
      title: `Remove ${personName}?`,
      message: 'They will be removed from this group.',
      confirmText: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    try {
      await removeMember.mutateAsync(userId);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not remove member');
    }
  };

  const doLeave = async () => {
    const ok = await confirmDialog({
      title: 'Leave group?',
      message: 'You will stop receiving messages from this group.',
      confirmText: 'Leave',
      destructive: true,
    });
    if (!ok) return;
    try {
      await leave.mutateAsync(convId);
      toast.success('You left the group');
      onLeft();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not leave group');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-sm flex-col animate-scale-in rounded-xl border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Users className="size-5" /> Group info
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </Button>
        </div>

        {/* name */}
        <div className="flex flex-col items-center gap-2 border-b p-5">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Users className="size-8" />
          </div>
          {editingName ? (
            <div className="flex w-full items-center gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus className="text-center" />
              <Button size="icon" onClick={saveName} disabled={rename.isPending} aria-label="Save name">
                {rename.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => { setEditingName(false); setName(conversation.name ?? ''); }} aria-label="Cancel">
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="group flex items-center gap-2 text-xl font-bold hover:text-primary"
              title="Rename group"
            >
              {conversation.name || 'Group'}
              <Pencil className="size-4 opacity-0 transition group-hover:opacity-100" />
            </button>
          )}
          <p className="text-sm text-muted-foreground">{members.length} members</p>
        </div>

        {/* members */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Members</span>
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <UserPlus className="size-4" /> Add
            </button>
          </div>

          {adding && (
            <div className="mb-2 rounded-lg border bg-background p-2">
              {candidates.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">No more friends to add.</p>
              ) : (
                <>
                  <div className="max-h-44 overflow-y-auto">
                    {candidates.map((f) => {
                      const on = selected.has(f.id);
                      return (
                        <button
                          key={f.id}
                          onClick={() => toggle(f.id)}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-accent"
                        >
                          <Avatar src={f.profilePicture} name={f.firstName} initials={initials(f)} size={32} />
                          <span className="min-w-0 flex-1 truncate text-sm">{fullName(f)}</span>
                          <span className={cn('flex size-5 items-center justify-center rounded-full border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40')}>
                            {on && <Check className="size-3.5" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <Button size="sm" className="mt-2 w-full" onClick={doAdd} disabled={selected.size === 0 || addMembers.isPending}>
                    {addMembers.isPending ? <Loader2 className="size-4 animate-spin" /> : `Add ${selected.size || ''}`.trim()}
                  </Button>
                </>
              )}
            </div>
          )}

          {isLoading && <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-primary" /></div>}
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent">
              <div className="relative">
                <Avatar src={m.profilePicture} name={m.firstName} initials={initials(m)} size={40} />
                {m.isOnline && <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-green-500" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{fullName(m)}{m.isMe && ' (You)'}</div>
              </div>
              {m.role === 'ADMIN' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  <ShieldCheck className="size-3" /> Admin
                </span>
              )}
              {isAdmin && !m.isMe && (
                <button
                  type="button"
                  onClick={() => doRemove(m.id, m.firstName)}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Remove ${m.firstName}`}
                  title="Remove from group"
                >
                  <UserMinus className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* leave */}
        <div className="border-t p-3">
          <Button variant="secondary" className="w-full text-destructive" onClick={doLeave} disabled={leave.isPending}>
            {leave.isPending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />} Leave group
          </Button>
        </div>
      </div>
    </div>
  );
}
