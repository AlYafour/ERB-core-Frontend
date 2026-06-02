'use client';

import { useLocale } from '@/lib/hooks/use-locale';

export default function LocaleToggle() {
  const { isArabic, setLocale } = useLocale();

  return (
    <button
      onClick={() => setLocale(isArabic ? 'en' : 'ar')}
      title={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: 6,
        border: '1px solid var(--border-primary)',
        background: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
        fontSize: 'var(--font-xs)',
        fontWeight: 'var(--font-weight-semibold)',
        cursor: 'pointer',
        letterSpacing: '0.03em',
        transition: 'background 0.15s, border-color 0.15s',
        fontFamily: "'Cairo', 'Segoe UI', system-ui, sans-serif",
        minWidth: 36,
        justifyContent: 'center',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-tertiary)';
        e.currentTarget.style.borderColor = 'var(--brand-orange)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-secondary)';
        e.currentTarget.style.borderColor = 'var(--border-primary)';
      }}
    >
      {isArabic ? 'EN' : 'ع'}
    </button>
  );
}
