'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bookmark, Loader2, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { SectionShell } from '@/components/layout/section-shell';
import { useCategories, useCreateProduct, useProducts, useSaveProduct } from '@/hooks/use-entities';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export default function MarketplacePage() {
  const [q, setQ] = React.useState('');
  const [category, setCategory] = React.useState('');
  const { data, isLoading } = useProducts(q, category);
  const { data: cats } = useCategories();
  const create = useCreateProduct();
  const save = useSaveProduct();
  const [open, setOpen] = React.useState(false);

  // create form state
  const [title, setTitle] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [condition, setCondition] = React.useState('USED');
  const [categoryId, setCategoryId] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [files, setFiles] = React.useState<File[]>([]);

  const submit = async () => {
    if (title.trim().length < 2 || !price) return toast.error('Title and price are required');
    const fd = new FormData();
    fd.append('title', title);
    fd.append('price', price);
    fd.append('condition', condition);
    fd.append('description', description);
    if (categoryId) fd.append('categoryId', categoryId);
    files.forEach((f) => fd.append('images', f));
    await create.mutateAsync(fd);
    setTitle(''); setPrice(''); setDescription(''); setFiles([]); setOpen(false);
    toast.success('Listing published');
  };

  return (
    <SectionShell
      title="Marketplace"
      max="max-w-6xl"
      action={<Button onClick={() => setOpen((v) => !v)}><Plus className="size-4" /> Sell something</Button>}
    >
      {open && (
        <Card className="animate-scale-in space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input type="number" min="0" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
            <select value={condition} onChange={(e) => setCondition(e.target.value)} className="h-10 rounded-md border border-input bg-card px-3 text-sm">
              {['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'USED'].map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-10 rounded-md border border-input bg-card px-3 text-sm">
              <option value="">Category…</option>
              {cats?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="text-sm" />
          <Button onClick={submit} disabled={create.isPending}>{create.isPending && <Loader2 className="size-4 animate-spin" />} Publish</Button>
        </Card>
      )}

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Marketplace" className="bg-transparent text-sm outline-none" />
        </div>
        <button onClick={() => setCategory('')} className={cn('rounded-full px-3 py-1.5 text-sm', !category ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>All</button>
        {cats?.categories.map((c) => (
          <button key={c.id} onClick={() => setCategory(c.slug)} className={cn('rounded-full px-3 py-1.5 text-sm', category === c.slug ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>{c.name}</button>
        ))}
      </div>

      {isLoading && <Loader2 className="size-6 animate-spin text-primary" />}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {data?.products.map((p) => (
          <Card key={p.id} className="card-hover overflow-hidden">
            <Link href={`/marketplace/${p.id}`}>
              <div className="aspect-square bg-secondary">
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl">🛍️</div>
                )}
              </div>
            </Link>
            <div className="space-y-1 p-3">
              <div className="font-bold">{p.currency} {p.price.toLocaleString()}</div>
              <Link href={`/marketplace/${p.id}`} className="line-clamp-1 text-sm hover:underline">{p.title}</Link>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{p.location ?? p.condition.replace('_', ' ')}</span>
                {!p.isOwn && (
                  <button onClick={() => save.mutate({ id: p.id, save: !p.isSaved })} title={p.isSaved ? 'Saved' : 'Save'}>
                    <Bookmark className={cn('size-4', p.isSaved ? 'fill-primary text-primary' : 'text-muted-foreground')} />
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {!isLoading && data?.products.length === 0 && <p className="text-muted-foreground">No listings found.</p>}
    </SectionShell>
  );
}
