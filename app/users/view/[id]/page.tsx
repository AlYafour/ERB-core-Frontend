'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function UserViewRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id;

  useEffect(() => {
    router.replace(`/users/${userId}`);
  }, [router, userId]);

  return null;
}
