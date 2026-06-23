'use client';

import MainLayout from '@/components/layout/MainLayout';
import { Loader } from '@/components/ui';

export default function AuthLoadingScreen() {
  return (
    <MainLayout>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
      }}>
        <Loader />
      </div>
    </MainLayout>
  );
}
