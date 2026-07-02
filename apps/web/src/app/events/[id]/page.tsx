'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CalendarDays, Globe, Loader2, MapPin, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { EventDTO, RSVPStatus } from '@fbclone/types';
import { SectionShell } from '@/components/layout/section-shell';
import { useDeleteEvent, useEvent, useRsvp, useUpdateEvent } from '@/hooks/use-entities';
import { confirmDialog } from '@/stores/confirm-store';
import { ApiClientError } from '@/lib/api-client';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fullName, initials } from '@/lib/utils';

/** Convert an ISO string to a value for a datetime-local input (local time). */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** Organizer-only edit dialog for an event. */
function EditEventDialog({ event, onClose }: { event: EventDTO; onClose: () => void }) {
  const update = useUpdateEvent(event.id);
  const [title, setTitle] = React.useState(event.title);
  const [description, setDescription] = React.useState(event.description ?? '');
  const [location, setLocation] = React.useState(event.location ?? '');
  const [isOnline, setIsOnline] = React.useState(event.isOnline);
  const [onlineUrl, setOnlineUrl] = React.useState(event.onlineUrl ?? '');
  const [startAt, setStartAt] = React.useState(toLocalInput(event.startAt));
  const [endAt, setEndAt] = React.useState(event.endAt ? toLocalInput(event.endAt) : '');

  const save = async () => {
    try {
      await update.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        isOnline,
        onlineUrl: onlineUrl.trim() || null,
        startAt: new Date(startAt).toISOString(),
        endAt: endAt ? new Date(endAt).toISOString() : null,
      });
      toast.success('Event updated');
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not update event');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <Card className="relative z-10 max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Edit event</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-accent"><X className="size-5" /></button>
        </div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={3} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} className="accent-primary" /> Online event
        </label>
        {isOnline ? (
          <Input value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} placeholder="Event link" />
        ) : (
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" />
        )}
        <label className="block text-xs text-muted-foreground">Starts
          <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="mt-1" />
        </label>
        <label className="block text-xs text-muted-foreground">Ends (optional)
          <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="mt-1" />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={update.isPending}>{update.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Save'}</Button>
        </div>
      </Card>
    </div>
  );
}

export default function EventDetailRoute() {
  const params = useParams();
  const id = String(params?.id ?? '');
  return (
    <SectionShell max="max-w-2xl">
      <EventDetail id={id} />
    </SectionShell>
  );
}

function EventDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data, isLoading, isError } = useEvent(id);
  const rsvp = useRsvp();
  const deleteEvent = useDeleteEvent();
  const [editing, setEditing] = React.useState(false);
  const event = data?.event;

  if (isLoading) return <Loader2 className="mx-auto size-7 animate-spin text-primary" />;
  if (isError || !event) {
    return (
      <Card className="space-y-3 p-8 text-center">
        <CalendarDays className="mx-auto size-8 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Event not found</h2>
        <Link href="/events" className="text-sm font-medium text-primary hover:underline">← Back to Events</Link>
      </Card>
    );
  }

  const set = (status: RSVPStatus) => rsvp.mutate({ id: event.id, status });
  const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  const onDelete = async () => {
    const ok = await confirmDialog({
      title: 'Delete event?',
      message: 'This permanently deletes the event and its RSVPs. This cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteEvent.mutateAsync(event.id);
      toast.success('Event deleted');
      router.push('/events');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not delete event');
    }
  };

  return (
    <div className="space-y-5">
      <Link href="/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="size-4" /> Events
      </Link>

      <Card className="overflow-hidden">
        <div
          className="flex h-40 items-center justify-center bg-gradient-to-br from-red-500/40 to-orange-500/30"
          style={event.coverPhoto ? { backgroundImage: `url(${event.coverPhoto})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        >
          {!event.coverPhoto && <CalendarDays className="size-14 text-white/90" />}
        </div>
        <div className="space-y-3 p-5">
          <div className="text-sm font-semibold uppercase text-primary">{fmt(event.startAt)}</div>
          <h1 className="text-2xl font-bold">{event.title}</h1>

          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            {event.isOnline ? (
              <span className="flex items-center gap-1.5"><Globe className="size-4" /> Online event{event.onlineUrl ? ` · ${event.onlineUrl}` : ''}</span>
            ) : event.location ? (
              <span className="flex items-center gap-1.5"><MapPin className="size-4" /> {event.location}</span>
            ) : null}
            <span>{event.goingCount} going · {event.interestedCount} interested</span>
          </div>

          <div className="flex items-center gap-2 border-t pt-3">
            <Avatar src={event.organizer.profilePicture} name={event.organizer.firstName} initials={initials(event.organizer)} size={32} />
            <div className="text-sm">
              <span className="text-muted-foreground">Hosted by </span>
              <Link href={`/u/${event.organizer.username}`} className="font-semibold hover:underline">{fullName(event.organizer)}</Link>
            </div>
          </div>

          {event.description && <p className="whitespace-pre-wrap border-t pt-3 text-sm">{event.description}</p>}

          <div className="flex gap-2 border-t pt-3">
            <Button variant={event.myRsvp === 'GOING' ? 'default' : 'secondary'} className="flex-1" onClick={() => set('GOING')} disabled={rsvp.isPending}>Going</Button>
            <Button variant={event.myRsvp === 'INTERESTED' ? 'default' : 'secondary'} className="flex-1" onClick={() => set('INTERESTED')} disabled={rsvp.isPending}>Interested</Button>
          </div>

          {event.isOwn && (
            <div className="flex gap-2 border-t pt-3">
              <Button variant="secondary" className="flex-1" onClick={() => setEditing(true)}><Pencil className="size-4" /> Edit</Button>
              <Button variant="secondary" className="flex-1 text-destructive" onClick={onDelete} disabled={deleteEvent.isPending}><Trash2 className="size-4" /> Delete</Button>
            </div>
          )}
        </div>
      </Card>

      {editing && <EditEventDialog event={event} onClose={() => setEditing(false)} />}
    </div>
  );
}
