'use client';

import { QueryProvider } from '@/lib/providers/query-provider';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <QueryProvider>{children}</QueryProvider>
    </ErrorBoundary>
  );
}

