'use client';

import { useLocale } from '@/lib/hooks/use-locale';

interface BilingualNameProps {
  nameEn: string;
  nameAr?: string | null;
  /** Size of the primary name. Secondary is always smaller. */
  primarySize?: string;
  secondarySize?: string;
  className?: string;
}

/**
 * Renders a bilingual name: the current locale's name is large & bold (primary),
 * the other language is small & muted below it.
 * If nameAr is absent, only the English name is shown.
 */
export default function BilingualName({
  nameEn,
  nameAr,
  primarySize = 'var(--font-base)',
  secondarySize = 'var(--font-xs)',
  className,
}: BilingualNameProps) {
  const { isArabic } = useLocale();

  const primaryName = isArabic ? (nameAr || nameEn) : nameEn;
  const secondaryName = isArabic ? (nameAr ? nameEn : null) : (nameAr || null);

  return (
    <span className={className} style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: primarySize, fontWeight: 'var(--font-weight-semibold)', lineHeight: 1.3 }}>
        {primaryName}
      </span>
      {secondaryName && (
        <span
          style={{ fontSize: secondarySize, color: 'var(--text-secondary)', lineHeight: 1.3 }}
          dir={isArabic ? 'ltr' : 'rtl'}
        >
          {secondaryName}
        </span>
      )}
    </span>
  );
}
