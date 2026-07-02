'use client';

import { Check, Clock, UserCheck, UserPlus, UserX } from 'lucide-react';
import { toast } from 'sonner';
import type { RelationStatus } from '@fbclone/types';
import {
  useCancelRequest,
  useFollow,
  useRespondRequest,
  useSendRequest,
  useUnfriend,
} from '@/hooks/use-friends';
import { Button } from '@/components/ui/button';
import { confirmDialog } from '@/stores/confirm-store';

interface Props {
  userId: string;
  relation: RelationStatus;
  requestId?: string;
  isFollowing: boolean;
}

/** Context-aware friend + follow actions for a profile. */
export function FriendButton({ userId, relation, requestId, isFollowing }: Props) {
  const send = useSendRequest();
  const respond = useRespondRequest();
  const cancel = useCancelRequest();
  const unfriend = useUnfriend();
  const follow = useFollow();

  if (relation === 'self') return null;

  const followBtn = (
    <Button
      variant={isFollowing ? 'secondary' : 'outline'}
      onClick={() => follow.mutate({ userId, follow: !isFollowing })}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {relation === 'none' && (
        <Button onClick={() => { send.mutate(userId); toast.success('Friend request sent'); }}>
          <UserPlus className="size-4" /> Add friend
        </Button>
      )}
      {relation === 'request_sent' && requestId && (
        <Button variant="secondary" onClick={() => cancel.mutate(requestId)}>
          <Clock className="size-4" /> Cancel request
        </Button>
      )}
      {relation === 'request_received' && requestId && (
        <>
          <Button onClick={() => respond.mutate({ id: requestId, accept: true })}>
            <Check className="size-4" /> Confirm
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              if (
                await confirmDialog({
                  title: 'Delete request?',
                  message: 'Decline this friend request?',
                  confirmText: 'Delete',
                  destructive: true,
                })
              )
                respond.mutate({ id: requestId, accept: false });
            }}
          >
            <UserX className="size-4" /> Delete
          </Button>
        </>
      )}
      {relation === 'friends' && (
        <Button
          variant="secondary"
          onClick={async () => {
            if (
              await confirmDialog({
                title: 'Unfriend?',
                message: 'Remove this person from your friends?',
                confirmText: 'Unfriend',
                destructive: true,
              })
            )
              unfriend.mutate(userId);
          }}
        >
          <UserCheck className="size-4" /> Friends
        </Button>
      )}
      {relation !== 'blocked' && followBtn}
    </div>
  );
}
