'use client';

import { ReactNode } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import ToastContainer from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { useRealtimeUpdates } from '@/lib/hooks/use-realtime';

export default function MainLayout({ children }: { children: ReactNode }) {
  useRealtimeUpdates();

  return (
    <>
      <Sidebar />
      <Navbar />
      <div className="app-content">
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{
            width: '100%',
            maxWidth: 'var(--content-max-width)',
            margin: '0 auto',
            padding: 'var(--content-padding)',
          }}>
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
      </div>
      <ToastContainer />
      <ConfirmDialog />
    </>
  );
}
