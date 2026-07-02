import * as React from 'react';
import { Download, File, FileArchive, FileSpreadsheet, FileText, Presentation } from 'lucide-react';
import { cn, formatBytes } from '@/lib/utils';

interface FileAttachmentProps {
  url: string;
  fileName: string | null;
  size: number | null;
  mimeType?: string | null;
  className?: string;
}

/** Pick an icon + accent color from the file's extension / mime type. */
function iconFor(name: string, mime?: string | null): { Icon: typeof File; color: string; label: string } {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  const is = (...xs: string[]) => xs.includes(ext);
  if (ext === 'pdf' || mime === 'application/pdf') return { Icon: FileText, color: 'text-red-500', label: 'PDF' };
  if (is('doc', 'docx')) return { Icon: FileText, color: 'text-blue-500', label: 'DOC' };
  if (is('xls', 'xlsx', 'csv')) return { Icon: FileSpreadsheet, color: 'text-emerald-500', label: ext.toUpperCase() };
  if (is('ppt', 'pptx')) return { Icon: Presentation, color: 'text-orange-500', label: 'PPT' };
  if (is('zip')) return { Icon: FileArchive, color: 'text-amber-500', label: 'ZIP' };
  if (is('txt')) return { Icon: FileText, color: 'text-muted-foreground', label: 'TXT' };
  return { Icon: File, color: 'text-muted-foreground', label: ext ? ext.toUpperCase() : 'FILE' };
}

/** A downloadable document card (icon + name + size), shared by chat & posts. */
export function FileAttachment({ url, fileName, size, mimeType, className }: FileAttachmentProps) {
  const name = fileName || 'Attachment';
  const { Icon, color } = iconFor(name, mimeType);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={fileName ?? undefined}
      className={cn(
        'group flex items-center gap-3 rounded-lg border bg-card p-2.5 transition-colors hover:bg-accent',
        className,
      )}
    >
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-md bg-muted', color)}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        {size != null && <span className="block text-xs text-muted-foreground">{formatBytes(size)}</span>}
      </span>
      <Download className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </a>
  );
}

const DOC_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'txt', 'csv'];
/** The `accept` attribute for document file inputs. */
export const DOC_ACCEPT = DOC_EXTS.map((e) => `.${e}`).join(',');

/** Client-side check: is this picked File a supported document (by extension)? */
export function isDocumentFile(file: File): boolean {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  return DOC_EXTS.includes(ext);
}
