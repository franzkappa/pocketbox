import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PocketBox - Read It Later',
  description: 'Self-hosted offline-first article reader',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PocketBox',
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0F172A',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-slate-900">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (('standalone' in window.navigator && window.navigator.standalone) || window.matchMedia('(display-mode: standalone)').matches) {
                  document.documentElement.classList.add('ios-standalone');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="h-full flex flex-col antialiased bg-slate-950 text-slate-100 select-none overflow-hidden">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').then(
                    (reg) => console.log('PocketBox Service Worker registered:', reg.scope),
                    (err) => console.log('Service Worker registration failed:', err)
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
