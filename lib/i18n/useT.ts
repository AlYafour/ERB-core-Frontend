'use client';
import { useLocale } from '@/lib/hooks/use-locale';
import { translations } from './translations';

type Sections = typeof translations;
type SectionKey = keyof Sections;
type EntryKey<S extends SectionKey> = keyof Sections[S];

export function useT() {
  const { locale } = useLocale();
  return function t<S extends SectionKey>(section: S, key: EntryKey<S>): string {
    const entry = translations[section][key] as { en: string; ar: string };
    return locale === 'ar' ? entry.ar : entry.en;
  };
}
