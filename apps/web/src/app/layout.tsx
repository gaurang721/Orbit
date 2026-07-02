import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: { default: 'Orbit', template: '%s · Orbit' },
  description: 'A modern social platform to share moments, chat, and connect.',
};

export const viewport: Viewport = {
  themeColor: '#1877F2',
  width: 'device-width',
  initialScale: 1,
};

// Apply the persisted theme before paint to avoid a flash. Defaults to dark.
const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.classList.toggle('dark',t!=='light');}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
