import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ERB Purchase System',
  description: 'Enterprise Resource and Budget Purchase Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Restore theme + locale before React hydrates to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('theme') || 'dark';
            document.documentElement.setAttribute('data-theme', t);
            var l = localStorage.getItem('locale');
            if (l === 'ar') {
              document.documentElement.setAttribute('dir', 'rtl');
              document.documentElement.setAttribute('lang', 'ar');
            }
          } catch(e) {
            document.documentElement.setAttribute('data-theme', 'dark');
          }
        `}} />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
