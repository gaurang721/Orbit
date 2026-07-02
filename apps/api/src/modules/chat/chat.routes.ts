import { Router } from 'express';
import type { Request, Response } from 'express';
import { addGroupMembersSchema, callLogSchema, createGroupChatSchema, forwardMessageSchema, messageReactionSchema, renameGroupChatSchema, sendMessageSchema, shareLocationSchema, startConversationSchema, updateLiveLocationSchema } from '@fbclone/types';
import type { AddGroupMembersInput, CallLogInput, CreateGroupChatInput, RenameGroupChatInput, ShareLocationInput, UpdateLiveLocationInput } from '@fbclone/types';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { uploadChatMedia, uploadDocument, uploadVoice } from '../../middleware/upload.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { sendSuccess } from '../../utils/response.js';
import { errors } from '../../utils/http-error.js';
import { publicUrl } from '../../lib/storage.js';
import { chatService } from './chat.service.js';

const router: Router = Router();
router.use(requireAuth);

/**
 * @openapi
 * /chat/conversations:
 *   get:
 *     tags: [Chat]
 *     summary: List the current user's conversations
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Conversations } }
 */
router.get(
  '/conversations',
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, { conversations: await chatService.listConversations(req.user!.id) });
  }),
);

/** Recent calls across all the user's conversations (for the Calls screen). */
router.get(
  '/calls',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    sendSuccess(res, { calls: await chatService.listCalls(req.user!.id, limit) });
  }),
);

/** Start (or fetch) a 1:1 conversation with another user. */
router.post(
  '/conversations',
  validate(startConversationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const conv = await chatService.startDirect(req.user!.id, (req.body as { userId: string }).userId);
    sendSuccess(res, { conversation: conv }, 201);
  }),
);

/** Create a group conversation (name + at least 2 other members). */
router.post(
  '/conversations/group',
  validate(createGroupChatSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, memberIds } = req.body as CreateGroupChatInput;
    const conv = await chatService.createGroup(req.user!.id, name, memberIds);
    sendSuccess(res, { conversation: conv }, 201);
  }),
);

// ----- Group management (rename / members / leave) --------------------------

/** List a group's members with role + presence (for the group-info panel). */
router.get(
  '/conversations/:id/members',
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, { members: await chatService.listMembers(req.user!.id, req.params.id!) });
  }),
);

/** Rename a group (any member). */
router.patch(
  '/conversations/:id',
  validate(renameGroupChatSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await chatService.renameGroup(req.user!.id, req.params.id!, (req.body as RenameGroupChatInput).name);
    sendSuccess(res, { ok: true });
  }),
);

/** Add members to a group (any member). */
router.post(
  '/conversations/:id/members',
  validate(addGroupMembersSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await chatService.addGroupMembers(req.user!.id, req.params.id!, (req.body as AddGroupMembersInput).memberIds);
    sendSuccess(res, { ok: true }, 201);
  }),
);

/** Remove a member from a group (admins/creator only). */
router.delete(
  '/conversations/:id/members/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    await chatService.removeGroupMember(req.user!.id, req.params.id!, req.params.userId!);
    sendSuccess(res, { ok: true });
  }),
);

/** Leave a group. */
router.post(
  '/conversations/:id/leave',
  asyncHandler(async (req: Request, res: Response) => {
    await chatService.leaveGroup(req.user!.id, req.params.id!);
    sendSuccess(res, { ok: true });
  }),
);

router.get(
  '/conversations/:id/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const cursor = (req.query.cursor as string | undefined) || undefined;
    const limit = Math.min(Number(req.query.limit) || 25, 50);
    sendSuccess(res, await chatService.listMessages(req.user!.id, req.params.id!, cursor, limit));
  }),
);

router.post(
  '/conversations/:id/messages',
  validate(sendMessageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const message = await chatService.sendMessage(req.user!.id, req.params.id!, (req.body as { content: string }).content);
    sendSuccess(res, { message }, 201);
  }),
);

/** Upload + send a recorded voice note (multipart: `voice` file + `duration`). */
router.post(
  '/conversations/:id/voice',
  uploadVoice,
  asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw errors.badRequest('No voice recording uploaded');
    const duration = Math.max(0, Math.round(Number((req.body as { duration?: string }).duration) || 0));
    const message = await chatService.sendVoiceMessage(req.user!.id, req.params.id!, {
      url: publicUrl(file.filename),
      mimeType: file.mimetype,
      size: file.size,
      duration,
    });
    sendSuccess(res, { message }, 201);
  }),
);

/** Upload + send a document attachment (multipart: `file`). */
router.post(
  '/conversations/:id/file',
  uploadDocument,
  asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw errors.badRequest('No file uploaded');
    const message = await chatService.sendFileMessage(req.user!.id, req.params.id!, {
      url: publicUrl(file.filename),
      mimeType: file.mimetype,
      size: file.size,
      fileName: file.originalname,
    });
    sendSuccess(res, { message }, 201);
  }),
);

/** Upload + send a photo/video (multipart: `media`). */
router.post(
  '/conversations/:id/media',
  uploadChatMedia,
  asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw errors.badRequest('No media uploaded');
    const mediaType = file.mimetype.startsWith('video/') ? 'VIDEO' : 'IMAGE';
    const message = await chatService.sendMediaMessage(req.user!.id, req.params.id!, {
      url: publicUrl(file.filename),
      mimeType: file.mimetype,
      size: file.size,
      mediaType,
    });
    sendSuccess(res, { message }, 201);
  }),
);

/** Share a geographic location as a message (JSON: latitude, longitude, label?). */
router.post(
  '/conversations/:id/location',
  validate(shareLocationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const message = await chatService.sendLocation(req.user!.id, req.params.id!, req.body as ShareLocationInput);
    sendSuccess(res, { message }, 201);
  }),
);

/** Push a fresh position into an active live-location share (owner only). */
router.patch(
  '/conversations/:id/location/:messageId',
  validate(updateLiveLocationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const message = await chatService.updateLiveLocation(req.user!.id, req.params.messageId!, req.body as UpdateLiveLocationInput);
    sendSuccess(res, { message });
  }),
);

/** Stop a live-location share early (owner only). */
router.post(
  '/conversations/:id/location/:messageId/stop',
  asyncHandler(async (req: Request, res: Response) => {
    const message = await chatService.stopLiveLocation(req.user!.id, req.params.messageId!);
    sendSuccess(res, { message });
  }),
);

/** React to a message with an emoji (one per user; upserts). */
router.post(
  '/conversations/:id/messages/:messageId/react',
  validate(messageReactionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const message = await chatService.reactToMessage(req.user!.id, req.params.messageId!, (req.body as { emoji: string }).emoji);
    sendSuccess(res, { message });
  }),
);

/** Remove the viewer's reaction from a message. */
router.delete(
  '/conversations/:id/messages/:messageId/react',
  asyncHandler(async (req: Request, res: Response) => {
    const message = await chatService.unreactMessage(req.user!.id, req.params.messageId!);
    sendSuccess(res, { message });
  }),
);

/** Unsend (delete for everyone) a message you sent. */
router.delete(
  '/conversations/:id/messages/:messageId',
  asyncHandler(async (req: Request, res: Response) => {
    const message = await chatService.deleteMessage(req.user!.id, req.params.messageId!);
    sendSuccess(res, { message });
  }),
);

/** Forward an existing message into another conversation. */
router.post(
  '/conversations/:id/forward',
  validate(forwardMessageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const message = await chatService.forwardMessage(
      req.user!.id,
      req.params.id!,
      (req.body as { messageId: string }).messageId,
    );
    sendSuccess(res, { message }, 201);
  }),
);

/** Record a finished voice/video call as a system message in the thread. */
router.post(
  '/conversations/:id/call-log',
  validate(callLogSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const message = await chatService.logCall(req.user!.id, req.params.id!, req.body as CallLogInput);
    sendSuccess(res, { message }, 201);
  }),
);

router.post(
  '/conversations/:id/read',
  asyncHandler(async (req: Request, res: Response) => {
    await chatService.markRead(req.user!.id, req.params.id!);
    sendSuccess(res, { ok: true });
  }),
);

export const chatRouter = router;
