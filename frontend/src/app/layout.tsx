import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DevContext',
  description: 'Cognee-powered developer memory.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
