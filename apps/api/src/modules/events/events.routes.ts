import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { createEventSchema, rsvpSchema, updateEventSchema, type EventDTO, type RSVPStatus, type UpdateEventInput } from '@fbclone/types';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { prisma } from '../../lib/prisma.js';
import { userRefSelect } from '../../lib/selects.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { errors } from '../../utils/http-error.js';
import { sendSuccess } from '../../utils/response.js';

const router: Router = Router();
router.use(requireAuth);

const include = { organizer: { select: userRefSelect } } satisfies Prisma.EventInclude;
type EventRow = Prisma.EventGetPayload<{ include: typeof include }>;

function toDTO(e: EventRow, myRsvp: RSVPStatus | null, meId: string): EventDTO {
  return {
    id: e.id, title: e.title, description: e.description, location: e.location,
    isOnline: e.isOnline, onlineUrl: e.onlineUrl, coverPhoto: e.coverPhoto,
    startAt: e.startAt.toISOString(), endAt: e.endAt ? e.endAt.toISOString() : null,
    organizer: e.organizer, goingCount: e.goingCount, interestedCount: e.interestedCount,
    myRsvp, isOwn: e.organizerId === meId, createdAt: e.createdAt.toISOString(),
  };
}

async function recountAndDto(eventId: string, meId: string): Promise<EventDTO> {
  const [going, interested] = await Promise.all([
    prisma.eventAttendee.count({ where: { eventId, status: 'GOING' } }),
    prisma.eventAttendee.count({ where: { eventId, status: 'INTERESTED' } }),
  ]);
  const event = await prisma.event.update({ where: { id: eventId }, data: { goingCount: going, interestedCount: interested }, include });
  const mine = await prisma.eventAttendee.findUnique({ where: { eventId_userId: { eventId, userId: meId } } });
  return toDTO(event, mine?.status ?? null, meId);
}

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const events = await prisma.event.findMany({ where: { groupId: null }, include, orderBy: { startAt: 'asc' }, take: 50 });
  const mine = await prisma.eventAttendee.findMany({ where: { userId: me, eventId: { in: events.map((e) => e.id) } } });
  const byEvent = new Map(mine.map((a) => [a.eventId, a.status]));
  sendSuccess(res, { events: events.map((e) => toDTO(e, byEvent.get(e.id) ?? null, me)) });
}));

router.post('/', validate(createEventSchema), asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const b = req.body as { title: string; description?: string; location?: string; isOnline: boolean; onlineUrl?: string; startAt: string; endAt?: string };
  const startAt = new Date(b.startAt);
  if (Number.isNaN(startAt.getTime())) throw errors.badRequest('Invalid start date');
  const event = await prisma.event.create({
    data: {
      organizerId: me, title: b.title, description: b.description, location: b.location,
      isOnline: b.isOnline, onlineUrl: b.onlineUrl, startAt,
      endAt: b.endAt ? new Date(b.endAt) : null,
      goingCount: 1,
      attendees: { create: { userId: me, status: 'GOING' } },
    },
    include,
  });
  sendSuccess(res, { event: toDTO(event, 'GOING', me) }, 201);
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const event = await prisma.event.findUnique({ where: { id: req.params.id! }, include });
  if (!event) throw errors.notFound('Event not found');
  const mine = await prisma.eventAttendee.findUnique({ where: { eventId_userId: { eventId: event.id, userId: me } } });
  sendSuccess(res, { event: toDTO(event, mine?.status ?? null, me) });
}));

/** Edit an event (organizer only). */
router.patch('/:id', validate(updateEventSchema), asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const existing = await prisma.event.findUnique({ where: { id: req.params.id! }, select: { organizerId: true } });
  if (!existing) throw errors.notFound('Event not found');
  if (existing.organizerId !== me) throw errors.forbidden('Only the organizer can edit this event');
  const b = req.body as UpdateEventInput;
  let startAt: Date | undefined;
  if (b.startAt !== undefined) {
    startAt = new Date(b.startAt);
    if (Number.isNaN(startAt.getTime())) throw errors.badRequest('Invalid start date');
  }
  const endAt = b.endAt !== undefined ? (b.endAt ? new Date(b.endAt) : null) : undefined;
  await prisma.event.update({
    where: { id: req.params.id! },
    data: {
      ...(b.title !== undefined ? { title: b.title } : {}),
      ...(b.description !== undefined ? { description: b.description } : {}),
      ...(b.location !== undefined ? { location: b.location } : {}),
      ...(b.isOnline !== undefined ? { isOnline: b.isOnline } : {}),
      ...(b.onlineUrl !== undefined ? { onlineUrl: b.onlineUrl } : {}),
      ...(startAt !== undefined ? { startAt } : {}),
      ...(endAt !== undefined ? { endAt } : {}),
    },
  });
  sendSuccess(res, { event: await recountAndDto(req.params.id!, me) });
}));

/** Delete an event and its RSVPs (organizer only). */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const existing = await prisma.event.findUnique({ where: { id: req.params.id! }, select: { organizerId: true } });
  if (!existing) throw errors.notFound('Event not found');
  if (existing.organizerId !== me) throw errors.forbidden('Only the organizer can delete this event');
  await prisma.event.delete({ where: { id: req.params.id! } });
  sendSuccess(res, { ok: true });
}));

router.post('/:id/rsvp', validate(rsvpSchema), asyncHandler(async (req: Request, res: Response) => {
  const me = req.user!.id;
  const { status } = req.body as { status: RSVPStatus };
  await prisma.eventAttendee.upsert({
    where: { eventId_userId: { eventId: req.params.id!, userId: me } },
    create: { eventId: req.params.id!, userId: me, status },
    update: { status },
  });
  sendSuccess(res, { event: await recountAndDto(req.params.id!, me) });
}));

export const eventsRouter = router;
