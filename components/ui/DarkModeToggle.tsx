'use client';

import { useEffect } from 'react';

export default function DarkModeToggle() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  }, []);

  return null;
}
