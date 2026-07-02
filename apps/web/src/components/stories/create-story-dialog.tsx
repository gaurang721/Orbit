'use client';

import * as React from 'react';
import { ImagePlus, Loader2, Type, X } from 'lucide-react';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api-client';
import { useCreateStory } from '@/hooks/use-stories';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const BG = ['#1877F2', '#E9710F', '#21A35E', '#9333EA', '#DB2777', '#0F172A'];

export function CreateStoryDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateStory();
  const [mode, setMode] = React.useState<'choose' | 'photo' | 'text'>('choose');
  const [file, setFile] = React.useState<File | null>(null);
  const [caption, setCaption] = React.useState('');
  const [bg, setBg] = React.useState(BG[0]!);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const preview = React.useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  React.useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const submit = async () => {
    try {
      if (mode === 'photo' && file) {
        const fd = new FormData();
        fd.append('image', file);
        if (caption.trim()) fd.append('caption', caption);
        await create.mutateAsync(fd);
      } else if (mode === 'text' && caption.trim()) {
        await create.mutateAsync({ caption, backgroundColor: bg });
      } else {
        toast.error('Add a photo or write something');
        return;
      }
      toast.success('Story shared!');
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not share story');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md animate-scale-in rounded-xl border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Create story</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-accent"><X className="size-5" /></button>
        </div>

        {mode === 'choose' && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setMode('photo'); setTimeout(() => fileInput.current?.click(), 0); }}
              className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 font-semibold hover:from-emerald-500/30"
            >
              <ImagePlus className="size-8 text-emerald-500" /> Photo story
            </button>
            <button
              onClick={() => setMode('text')}
              className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 font-semibold hover:from-primary/30"
            >
              <Type className="size-8 text-primary" /> Text story
            </button>
          </div>
        )}

        {mode === 'photo' && (
          <div className="space-y-3">
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="max-h-72 w-full rounded-lg object-contain" />
            ) : (
              <button onClick={() => fileInput.current?.click()} className="flex h-48 w-full items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground hover:bg-accent">
                Click to choose a photo
              </button>
            )}
            <Textarea placeholder="Add a caption…" value={caption} onChange={(e) => setCaption(e.target.value)} className="min-h-[60px]" />
          </div>
        )}

        {mode === 'text' && (
          <div className="space-y-3">
            <div className="flex min-h-48 items-center justify-center rounded-lg p-6 text-center text-xl font-semibold text-white" style={{ background: bg }}>
              {caption || 'Your text story…'}
            </div>
            <Textarea placeholder="Write something…" value={caption} onChange={(e) => setCaption(e.target.value)} className="min-h-[60px]" />
            <div className="flex gap-2">
              {BG.map((c) => (
                <button key={c} onClick={() => setBg(c)} className={cn('size-7 rounded-full', bg === c && 'ring-2 ring-foreground ring-offset-2 ring-offset-card')} style={{ background: c }} />
              ))}
            </div>
          </div>
        )}

        {mode !== 'choose' && (
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setMode('choose'); setFile(null); setCaption(''); }}>Back</Button>
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending && <Loader2 className="size-4 animate-spin" />} Share to story
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
