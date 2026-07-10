const _year = String(new Date().getFullYear());

/** Tenant-side brand (used by the landing page and company-login flow). */
export const BRAND = {
  name:        'XERB',
  tagline:     'Operations & Procurement Platform',
  description: 'The all-in-one operations platform for construction and contracting companies.',
  year:        _year,
} as const;

/** XERB platform brand (used by platform-login and the super-admin area). */
export const XERB = {
  name:    'XERB',
  tagline: 'Platform Administration',
  logo:    '/xerb-logo.svg',
  year:    _year,
  colors: {
    primary:      '#C9943A',
    primaryHover: '#B8832E',
    primaryDark:  '#A07228',
    subtle:       '#FBF4E8',
    muted:        '#F5E9D3',
    accent:       '#C9943A',
    accentLight:  '#E0AE55',
    accentPale:   '#EBC880',
    darkBg:       '#07101F',
    darkSurface:  '#0F1D30',
    darkDeep:     '#152640',
  },
} as const;
