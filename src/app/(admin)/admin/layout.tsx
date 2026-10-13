import type { Metadata, Viewport } from 'next';
import '../../globals.css';

export const metadata: Metadata = {
  title: 'ChronoSleep · Admin',
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

/** FR-18: separate root layout, noindex, no public navigation. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh bg-bg">{children}</body>
    </html>
  );
}
