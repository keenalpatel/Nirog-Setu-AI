import './globals.css';
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { Providers } from '@/components/providers';
import { AuthProvider } from '@/lib/auth-context';
import { AppShell } from '@/components/layout/app-shell';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'Nirog-Setu AI - Rural Healthcare Platform',
  description: 'Voice-first, multilingual AI healthcare platform for rural India',
  openGraph: {
    title: 'Nirog-Setu AI - Rural Healthcare Platform',
    description: 'Voice-first, multilingual AI healthcare platform for rural India powered by Gemini and Bhashini',
    images: [
      {
        url: 'https://images.pexels.com/photo_4226147/pexels-photo-4226147.jpeg',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nirog-Setu AI',
    description: 'Voice-first, multilingual AI healthcare platform for rural India',
    images: [
      {
        url: 'https://images.pexels.com/photo_4226147/pexels-photo-4226147.jpeg',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <Providers>
          <AuthProvider>
            <div className="fixed inset-0 aurora-bg -z-10" />
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
