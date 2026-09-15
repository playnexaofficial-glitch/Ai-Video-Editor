import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'AI Clip Editor',
  description: 'Browser-based short-video editor with AI-powered edit planning and IndexedDB media storage.',
  openGraph: {
    title: 'AI Clip Editor',
    description: 'Browser-based short-video editor with AI-powered edit planning and IndexedDB media storage.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Clip Editor',
    description: 'Browser-based short-video editor with AI-powered edit planning and IndexedDB media storage.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
