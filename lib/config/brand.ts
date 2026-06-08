/** Tenant-side brand (used by the landing page and company-login flow). */
export const BRAND = {
  name:        'XERB',
  tagline:     'Operations & Procurement Platform',
  description: 'The all-in-one operations platform for construction and contracting companies.',
  year:        '2025',
} as const;

/** XERB platform brand (used by platform-login and the super-admin area). */
export const XERB = {
  name:    'XERB',
  tagline: 'Platform Administration',
  logo:    '/xerb-logo.svg',
  year:    '2025',
  colors: {
    primary:      '#4F46E5',
    primaryHover: '#4338CA',
    primaryDark:  '#3730A3',
    subtle:       '#EEF2FF',
    muted:        '#E0E7FF',
    accent:       '#6366F1',
    accentLight:  '#818CF8',
    accentPale:   '#A5B4FC',
    darkBg:       '#0F0E2A',
    darkSurface:  '#1a1745',
    darkDeep:     '#312E81',
  },
} as const;
