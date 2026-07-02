import type { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server as SocketServer, type Socket } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { redis, redisEnabled } from '../lib/redis.js';
import { verifyAccessToken } from '../utils/jwt.js';

interface AuthedSocket extends Socket {
  userId?: string;
}

let io: SocketServer | null = null;

/**
 * Initialize the realtime layer. Authentication uses the same JWT access token
 * as the REST API, passed via `socket.handshake.auth.token`. Feature namespaces
 * (chat, notifications, presence) are added in later phases — this establishes
 * the authenticated connection, per-user rooms, and online presence.
 */
export function initSocket(server: HttpServer): SocketServer {
  io = new SocketServer(server, {
    cors: { origin: env.corsOrigins, credentials: true },
    path: '/socket.io',
  });

  // ----- Multi-node broadcast (Redis adapter) --------------------------------
  // Without this, realtime events (chat, presence, call signaling) only reach
  // clients connected to the same node. The adapter fans events across all API
  // replicas via Redis pub/sub. When Redis is disabled (local dev) we keep the
  // default in-memory adapter, which is correct for a single node.
  if (redisEnabled) {
    try {
      io.adapter(createAdapter(redis, redis.duplicate()));
      logger.info('✅ Socket.io Redis adapter enabled (cross-node broadcast)');
    } catch (err) {
      logger.error({ err }, 'Failed to enable Socket.io Redis adapter — using in-memory');
    }
  }

  // ----- Handshake auth ------------------------------------------------------
  io.use((socket: AuthedSocket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      socket.handshake.headers.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('UNAUTHORIZED'));
    try {
      const payload = verifyAccessToken(token);
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', async (socket: AuthedSocket) => {
    const userId = socket.userId!;
    socket.join(`user:${userId}`);
    logger.debug({ userId, socketId: socket.id }, 'socket connected');

    await markPresence(userId, true);
    socket.broadcast.emit('presence:update', { userId, isOnline: true });

    // Relay typing indicators to the other participant in a 1:1 chat.
    socket.on('chat:typing', (payload: { toUserId?: string; conversationId?: string; isTyping?: boolean }) => {
      if (!payload?.toUserId || !payload.conversationId) return;
      emitToUser(payload.toUserId, 'chat:typing', {
        conversationId: payload.conversationId,
        fromUserId: userId,
        isTyping: !!payload.isTyping,
      });
    });

    // Relay WebRTC voice-call signaling to the other participant. The server is
    // a dumb pipe here — it never inspects the SDP/ICE `data`, just forwards it
    // and stamps the authenticated sender so the callee knows who's calling.
    socket.on(
      'call:signal',
      (payload: {
        toUserId?: string;
        conversationId?: string;
        kind?: string;
        data?: unknown;
        from?: unknown;
        video?: boolean;
      }) => {
        if (!payload?.toUserId || !payload.conversationId || !payload.kind) return;
        emitToUser(payload.toUserId, 'call:signal', {
          conversationId: payload.conversationId,
          fromUserId: userId,
          kind: payload.kind,
          data: payload.data,
          from: payload.from,
          video: payload.video,
        });
      },
    );

    socket.on('disconnect', async () => {
      // Only flip offline when the user has no other active sockets.
      const room = io?.sockets.adapter.rooms.get(`user:${userId}`);
      if (!room || room.size === 0) {
        await markPresence(userId, false);
        socket.broadcast.emit('presence:update', { userId, isOnline: false, lastSeenAt: new Date().toISOString() });
      }
    });
  });

  logger.info('✅ Socket.io initialized');
  return io;
}

async function markPresence(userId: string, isOnline: boolean): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { isOnline, lastSeenAt: new Date() },
    });
  } catch (err) {
    logger.warn({ err, userId }, 'Failed to update presence');
  }
}

/** Emit an event to a specific user's room (used by notifications/chat later). */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function getIo(): SocketServer | null {
  return io;
}
