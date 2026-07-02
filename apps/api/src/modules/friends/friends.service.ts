import type { FriendRequestDTO, PersonCardDTO, PublicUser, RelationStatus, UserRef } from '@fbclone/types';
import { errors } from '../../utils/http-error.js';
import { notificationsService } from '../notifications/notifications.service.js';
import { friendsRepository } from './friends.repository.js';

// The shape returned by friend queries using publicUserSelect.
type PublicRow = Awaited<ReturnType<typeof friendsRepository.listFriends>>[number];

function toPublicUser(u: PublicRow): PublicUser {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    profilePicture: u.profilePicture,
    coverPhoto: u.coverPhoto,
    bio: u.bio,
    verified: u.verified,
    isOnline: u.isOnline,
    lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
  };
}

function toUserRef(u: { id: string; firstName: string; lastName: string; username: string; profilePicture: string | null; verified: boolean }): UserRef {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    profilePicture: u.profilePicture,
    verified: u.verified,
  };
}

export const friendsService = {
  /** Compute the viewer's relationship to another user (drives UI buttons). */
  async relationTo(meId: string, otherId: string): Promise<{ relation: RelationStatus; requestId?: string; isFollowing: boolean }> {
    if (meId === otherId) return { relation: 'self', isFollowing: false };
    if (await friendsRepository.isBlockedEitherWay(meId, otherId)) {
      return { relation: 'blocked', isFollowing: false };
    }
    const [fr, isFollowing] = await Promise.all([
      friendsRepository.findBetween(meId, otherId),
      friendsRepository.isFollowing(meId, otherId),
    ]);
    if (!fr) return { relation: 'none', isFollowing };
    if (fr.status === 'ACCEPTED') return { relation: 'friends', requestId: fr.id, isFollowing };
    if (fr.status === 'PENDING') {
      return {
        relation: fr.requesterId === meId ? 'request_sent' : 'request_received',
        requestId: fr.id,
        isFollowing,
      };
    }
    return { relation: 'none', isFollowing };
  },

  async sendRequest(meId: string, targetId: string): Promise<{ status: RelationStatus; requestId: string }> {
    if (meId === targetId) throw errors.badRequest('You cannot friend yourself');
    if (await friendsRepository.isBlockedEitherWay(meId, targetId)) {
      throw errors.forbidden('Unable to send a request to this user');
    }
    const existing = await friendsRepository.findBetween(meId, targetId);
    if (existing) {
      if (existing.status === 'ACCEPTED') throw errors.conflict('You are already friends');
      if (existing.requesterId === meId) throw errors.conflict('Request already sent');
      // They already requested us → accept it.
      const accepted = await friendsRepository.accept(existing.id);
      await notificationsService.notify({
        recipientId: existing.requesterId,
        actorId: meId,
        type: 'FRIEND_ACCEPT',
        message: 'accepted your friend request',
        link: `/u/${meId}`,
        entityType: 'User',
        entityId: meId,
      });
      return { status: 'friends', requestId: accepted.id };
    }
    const created = await friendsRepository.create(meId, targetId);
    await notificationsService.notify({
      recipientId: targetId,
      actorId: meId,
      type: 'FRIEND_REQUEST',
      message: 'sent you a friend request',
      link: '/friends',
      entityType: 'Friendship',
      entityId: created.id,
    });
    return { status: 'request_sent', requestId: created.id };
  },

  async respondToRequest(meId: string, requestId: string, accept: boolean): Promise<RelationStatus> {
    const req = await friendsRepository.findRequest(requestId);
    if (!req || req.addresseeId !== meId || req.status !== 'PENDING') {
      throw errors.notFound('Friend request not found');
    }
    if (!accept) {
      await friendsRepository.delete(req.id);
      return 'none';
    }
    await friendsRepository.accept(req.id);
    await notificationsService.notify({
      recipientId: req.requesterId,
      actorId: meId,
      type: 'FRIEND_ACCEPT',
      message: 'accepted your friend request',
      link: `/u/${meId}`,
      entityType: 'User',
      entityId: meId,
    });
    return 'friends';
  },

  async cancelRequest(meId: string, requestId: string): Promise<void> {
    const req = await friendsRepository.findRequest(requestId);
    if (!req || req.requesterId !== meId || req.status !== 'PENDING') {
      throw errors.notFound('Request not found');
    }
    await friendsRepository.delete(req.id);
  },

  async unfriend(meId: string, otherId: string): Promise<void> {
    const fr = await friendsRepository.findBetween(meId, otherId);
    if (!fr || fr.status !== 'ACCEPTED') throw errors.notFound('You are not friends');
    await friendsRepository.delete(fr.id);
  },

  async follow(meId: string, targetId: string): Promise<void> {
    if (meId === targetId) throw errors.badRequest('You cannot follow yourself');
    await friendsRepository.follow(meId, targetId);
    await notificationsService.notify({
      recipientId: targetId,
      actorId: meId,
      type: 'FOLLOW',
      message: 'started following you',
      link: `/u/${meId}`,
      entityType: 'User',
      entityId: meId,
    });
  },

  async unfollow(meId: string, targetId: string): Promise<void> {
    await friendsRepository.unfollow(meId, targetId);
  },

  async listFriends(userId: string): Promise<PublicUser[]> {
    return (await friendsRepository.listFriends(userId)).map(toPublicUser);
  },

  async listRequests(userId: string): Promise<FriendRequestDTO[]> {
    const rows = await friendsRepository.listIncomingRequests(userId);
    return rows.map((r) => ({ id: r.id, user: toUserRef(r.requester), createdAt: r.createdAt.toISOString() }));
  },

  async listSuggestions(userId: string): Promise<PersonCardDTO[]> {
    const exclude = await friendsRepository.relatedUserIds(userId);
    const users = await friendsRepository.suggestions(userId, exclude, 10);
    return users.map((u) => ({ user: toPublicUser(u), relation: 'none' as const }));
  },
};
