'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Bookmark, CheckCircle2, Loader2, MessageCircle, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductDTO } from '@fbclone/types';
import { SectionShell } from '@/components/layout/section-shell';
import { useDeleteProduct, useProduct, useSaveProduct, useUpdateProduct } from '@/hooks/use-entities';
import { useStartConversation } from '@/hooks/use-chat';
import { confirmDialog } from '@/stores/confirm-store';
import { ApiClientError } from '@/lib/api-client';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn, fullName, initials, timeAgo } from '@/lib/utils';

const CONDITIONS: ProductDTO['condition'][] = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'USED'];

/** Owner-only edit dialog for a listing's core fields. */
function EditProductDialog({ product, onClose }: { product: ProductDTO; onClose: () => void }) {
  const update = useUpdateProduct();
  const [title, setTitle] = React.useState(product.title);
  const [price, setPrice] = React.useState(String(product.price));
  const [currency, setCurrency] = React.useState(product.currency);
  const [condition, setCondition] = React.useState(product.condition);
  const [location, setLocation] = React.useState(product.location ?? '');
  const [description, setDescription] = React.useState(product.description);

  const save = async () => {
    try {
      await update.mutateAsync({
        id: product.id,
        input: {
          title: title.trim(),
          price: Number(price) || 0,
          currency: currency.trim() || 'USD',
          condition,
          location: location.trim() || null,
          description: description.trim(),
        },
      });
      toast.success('Listing updated');
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not update listing');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-md space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Edit listing</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-accent"><X className="size-5" /></button>
        </div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <div className="flex gap-2">
          <Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" placeholder="Price" className="flex-1" />
          <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="USD" className="w-24" />
        </div>
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value as ProductDTO['condition'])}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
        >
          {CONDITIONS.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)" />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={4}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function ProductDetailPage() {
  const id = String(useParams().id ?? '');
  const router = useRouter();
  const { data, isLoading } = useProduct(id);
  const save = useSaveProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const startChat = useStartConversation();
  const [active, setActive] = React.useState(0);
  const [editing, setEditing] = React.useState(false);

  const toggleSold = async (product: ProductDTO) => {
    const next = product.status === 'SOLD' ? 'AVAILABLE' : 'SOLD';
    try {
      await updateProduct.mutateAsync({ id: product.id, input: { status: next } });
      toast.success(next === 'SOLD' ? 'Marked as sold' : 'Marked as available');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not update listing');
    }
  };

  const onDelete = async (product: ProductDTO) => {
    const ok = await confirmDialog({
      title: 'Delete listing?',
      message: 'This permanently removes the listing. This cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteProduct.mutateAsync(product.id);
      toast.success('Listing deleted');
      router.push('/marketplace');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not delete listing');
    }
  };

  if (isLoading) return <SectionShell><Loader2 className="size-7 animate-spin text-primary" /></SectionShell>;
  if (!data) return <SectionShell><p className="text-muted-foreground">Listing not found.</p></SectionShell>;
  const p = data.product;

  return (
    <SectionShell max="max-w-5xl">
      <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
        {/* gallery */}
        <Card className="overflow-hidden">
          <div className="relative aspect-square bg-secondary">
            {p.images[active] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.images[active]} alt="" className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center text-6xl">🛍️</div>
            )}
            {p.status === 'SOLD' && (
              <span className="absolute left-3 top-3 rounded-full bg-destructive px-3 py-1 text-sm font-bold text-destructive-foreground">
                SOLD
              </span>
            )}
          </div>
          {p.images.length > 1 && (
            <div className="flex gap-2 p-2">
              {p.images.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="" onClick={() => setActive(i)} className={cn('size-16 cursor-pointer rounded object-cover', i === active && 'ring-2 ring-primary')} />
              ))}
            </div>
          )}
        </Card>

        {/* info */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{p.title}</h1>
            <div className="mt-1 text-xl font-semibold">{p.currency} {p.price.toLocaleString()}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {p.condition.replace('_', ' ')} · {p.location ?? 'Location N/A'} · {timeAgo(p.createdAt)}
            </div>
          </div>

          <div className="flex gap-2">
            {!p.isOwn && (
              <Button onClick={async () => { const { conversation } = await startChat.mutateAsync(p.seller.id); router.push(`/messages?c=${conversation.id}`); }} disabled={startChat.isPending}>
                {startChat.isPending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />} Message seller
              </Button>
            )}
            {!p.isOwn && (
              <Button variant="secondary" onClick={() => { save.mutate({ id: p.id, save: !p.isSaved }); toast.success(p.isSaved ? 'Removed' : 'Saved'); }}>
                <Bookmark className={cn('size-4', p.isSaved && 'fill-current')} /> {p.isSaved ? 'Saved' : 'Save'}
              </Button>
            )}
          </div>

          {p.isOwn && (
            <Card className="space-y-2 p-4">
              <h2 className="text-sm font-semibold text-muted-foreground">Manage your listing</h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => toggleSold(p)} disabled={updateProduct.isPending}>
                  {p.status === 'SOLD' ? <><RotateCcw className="size-4" /> Mark available</> : <><CheckCircle2 className="size-4" /> Mark as sold</>}
                </Button>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" /> Edit
                </Button>
                <Button variant="secondary" className="text-destructive" onClick={() => onDelete(p)} disabled={deleteProduct.isPending}>
                  <Trash2 className="size-4" /> Delete
                </Button>
              </div>
            </Card>
          )}

          <Card className="space-y-2 p-4">
            <h2 className="font-semibold">Description</h2>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{p.description || 'No description.'}</p>
          </Card>

          <Card className="flex items-center gap-3 p-4">
            <Link href={`/u/${p.seller.username}`}><Avatar src={p.seller.profilePicture} name={p.seller.firstName} initials={initials(p.seller)} /></Link>
            <div>
              <div className="text-xs text-muted-foreground">Seller</div>
              <Link href={`/u/${p.seller.username}`} className="font-semibold hover:underline">{fullName(p.seller)}</Link>
            </div>
          </Card>
        </div>
      </div>
      {editing && <EditProductDialog product={p} onClose={() => setEditing(false)} />}
    </SectionShell>
  );
}
