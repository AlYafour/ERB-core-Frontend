'use client';

import { useCallback, useEffect, useState } from 'react';

export type Locale = 'en' | 'ar';

const STORAGE_KEY = 'locale';

export function useLocale() {
  // Always start with 'en' on server AND client first render to avoid hydration mismatch.
  // After mount, read localStorage and update if needed.
  const [locale, setLocaleState] = useState<Locale>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read stored locale after hydration
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'ar') setLocaleState('ar');
    } catch {}
    setMounted(true);

    const handler = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        setLocaleState(stored === 'ar' ? 'ar' : 'en');
      } catch {}
    };
    window.addEventListener('locale-change', handler);
    return () => window.removeEventListener('locale-change', handler);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
    setLocaleState(l);
    document.documentElement.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', l);
    window.dispatchEvent(new Event('locale-change'));
  }, []);

  // Before mount: treat as 'en' to match SSR output
  const effectiveLocale: Locale = mounted ? locale : 'en';
  const isArabic = effectiveLocale === 'ar';

  return { locale: effectiveLocale, setLocale, isArabic, mounted };
}
