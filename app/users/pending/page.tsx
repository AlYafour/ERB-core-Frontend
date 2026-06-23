'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PendingUsersRedirectPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/hr/employees'); }, [router]);
  return null;
}
