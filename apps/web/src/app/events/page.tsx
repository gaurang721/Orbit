'use client';

import * as React from 'react';
import Link from 'next/link';
import { CalendarDays, Loader2, MapPin, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { RSVPStatus } from '@fbclone/types';
import { SectionShell } from '@/components/layout/section-shell';
import { useCreateEvent, useEvents, useRsvp } from '@/hooks/use-entities';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export default function EventsPage() {
  const { data, isLoading } = useEvents();
  const create = useCreateEvent();
  const rsvp = useRsvp();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [startAt, setStartAt] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [description, setDescription] = React.useState('');

  const submit = async () => {
    if (title.trim().length < 2 || !startAt) return toast.error('Title and date are required');
    await create.mutateAsync({ title, startAt: new Date(startAt).toISOString(), location, description, isOnline: false });
    setTitle(''); setStartAt(''); setLocation(''); setDescription(''); setOpen(false);
    toast.success('Event created');
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <SectionShell
      title="Events"
      action={<Button onClick={() => setOpen((v) => !v)}><Plus className="size-4" /> Create event</Button>}
    >
      {open && (
        <Card className="animate-scale-in space-y-3 p-4">
          <Input placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <Textarea placeholder="Details" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button onClick={submit} disabled={create.isPending}>{create.isPending && <Loader2 className="size-4 animate-spin" />} Create</Button>
        </Card>
      )}

      {isLoading && <Loader2 className="size-6 animate-spin text-primary" />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.events.map((e) => {
          const set = (status: RSVPStatus) => rsvp.mutate({ id: e.id, status });
          return (
            <Card key={e.id} className="card-hover flex flex-col overflow-hidden">
              <div className="flex h-24 items-center justify-center bg-gradient-to-br from-red-500/40 to-orange-500/30">
                <CalendarDays className="size-10 text-white/90" />
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <div className="text-xs font-semibold uppercase text-primary">{fmt(e.startAt)}</div>
                <Link href={`/events/${e.id}`} className="font-bold hover:underline">{e.title}</Link>
                {e.location && <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3.5" /> {e.location}</p>}
                <p className="text-xs text-muted-foreground">{e.goingCount} going · {e.interestedCount} interested</p>
                <div className="mt-auto flex gap-2 pt-2">
                  <Button size="sm" variant={e.myRsvp === 'GOING' ? 'default' : 'secondary'} className="flex-1" onClick={() => set('GOING')}>Going</Button>
                  <Button size="sm" variant={e.myRsvp === 'INTERESTED' ? 'default' : 'secondary'} className={cn('flex-1')} onClick={() => set('INTERESTED')}>Interested</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {!isLoading && data?.events.length === 0 && <p className="text-muted-foreground">No upcoming events — create one!</p>}
    </SectionShell>
  );
}
