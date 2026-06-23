import type { Metadata } from 'next';
import Sidebar from '@/components/layout/Sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dev-Context Assistant',
  description: 'Persistent developer memory powered by Cognee',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <div className="app-shell">
          <Sidebar />
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
