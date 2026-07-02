'use client';

import * as React from 'react';
import { Check, Loader2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ConversationDTO } from '@fbclone/types';
import { useStartGroup } from '@/hooks/use-chat';
import { useFriends } from '@/hooks/use-friends';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, fullName, initials } from '@/lib/utils';

/** Create a group chat: name it and pick at least 2 friends. */
export function NewGroupDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (conversation: ConversationDTO) => void;
}) {
  const { data, isLoading } = useFriends();
  const createGroup = useStartGroup();
  const [name, setName] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const friends = data?.friends ?? [];

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canCreate = name.trim().length > 0 && selected.size >= 2 && !createGroup.isPending;

  const create = async () => {
    if (!canCreate) return;
    try {
      const { conversation } = await createGroup.mutateAsync({
        name: name.trim(),
        memberIds: [...selected],
      });
      toast.success('Group created');
      onCreated(conversation);
      onClose();
    } catch {
      toast.error('Could not create group');
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
        className="flex max-h-[80vh] w-full max-w-sm flex-col animate-scale-in rounded-xl border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Users className="size-5" /> New group
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </Button>
        </div>

        <div className="border-b p-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            maxLength={80}
            autoFocus
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {selected.size} selected · pick at least 2 people
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          )}
          {!isLoading && friends.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Add some friends first — you can only add friends to a group.
            </p>
          )}
          {friends.map((f) => {
            const on = selected.has(f.id);
            return (
              <button
                key={f.id}
                onClick={() => toggle(f.id)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent"
              >
                <Avatar src={f.profilePicture} name={f.firstName} initials={initials(f)} size={40} />
                <span className="min-w-0 flex-1 truncate font-medium">{fullName(f)}</span>
                <span
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full border',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                  )}
                >
                  {on && <Check className="size-3.5" />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="border-t p-3">
          <Button className="w-full" onClick={create} disabled={!canCreate}>
            {createGroup.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Create group'}
          </Button>
        </div>
      </div>
    </div>
  );
}
