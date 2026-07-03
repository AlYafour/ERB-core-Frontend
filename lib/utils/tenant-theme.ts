/* ================================================================
   TENANT THEME UTILITY
   Derives EVERY app color from a single brand hex.
   Structural backgrounds (sidebar, navbar, surfaces, inputs, cards,
   tables, dropdowns) are generated at the brand hue with low sat so
   the tint is professional and not overwhelming.
   ================================================================ */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').slice(0, 6);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))
      .toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function generateScale(primaryHex: string): Record<string, string> {
  const [r, g, b] = hexToRgb(primaryHex);
  const [h, s, l] = rgbToHsl(r, g, b);
  return {
    '50':  hslToHex(h, clamp(s * 0.22, 6,  40), clamp(97 - l * 0.04, 93, 98)),
    '100': hslToHex(h, clamp(s * 0.38, 10, 50), clamp(92 - l * 0.04, 87, 94)),
    '200': hslToHex(h, clamp(s * 0.58, 16, 65), clamp(82 - l * 0.04, 76, 88)),
    '300': hslToHex(h, clamp(s * 0.76, 22, 78), clamp(l + 24, 55, 76)),
    '400': hslToHex(h, clamp(s * 0.92, 32, 92), clamp(l + 12, 46, 68)),
    '500': primaryHex,
    '600': hslToHex(h, clamp(s * 1.05, 38, 100), clamp(l - 9,  14, 54)),
    '700': hslToHex(h, clamp(s * 1.08, 38, 100), clamp(l - 19, 10, 44)),
    '800': hslToHex(h, clamp(s * 1.10, 38, 100), clamp(l - 28,  7, 35)),
    '900': hslToHex(h, clamp(s * 1.12, 38, 100), clamp(l - 37,  4, 27)),
  };
}

export function buildThemeCss(primaryHex: string): string {
  if (!primaryHex || !primaryHex.startsWith('#') || primaryHex.length < 7) return '';

  const scale = generateScale(primaryHex);
  const [r, g, b] = hexToRgb(primaryHex);
  const [h, , l] = rgbToHsl(r, g, b);

  // Accent colors for dark mode — brighter than primary for readability on dark bg
  const darkActive = hslToHex(h, 55, clamp(l + 18, 58, 82));
  const darkHover  = hslToHex(h, 50, clamp(l + 27, 65, 86));

  // Structural dark backgrounds — same hue, low saturation, dark lightness
  // This gives a subtle professional tint (not overwhelming)
  const S = 18; // structural saturation — low so the bg reads as near-neutral

  // Sidebar/navbar — always dark regardless of light/dark mode
  const navbarBg       = hslToHex(h, S, 6);
  const sidebarBg      = hslToHex(h, S, 8);
  const sidebarBorder  = hslToHex(h, S, 12);
  const sidebarText    = hslToHex(h, 14, 37);
  const sidebarTextHov = hslToHex(h, 10, 87);
  const sidebarSection = hslToHex(h, S, 16);
  const navbarBorder   = hslToHex(h, S, 13);

  // Dark mode page surfaces
  const surfaceApp      = hslToHex(h, 14, 10);
  const surfaceBase     = hslToHex(h, 18, 13);
  const surfaceRaised   = hslToHex(h, 18, 16);
  const surfaceOverlay  = hslToHex(h, 18, 18);
  const surfaceSubtle   = hslToHex(h, 20, 15);

  // Dark mode borders
  const borderSubtle  = hslToHex(h, 20, 16);
  const borderDefault = hslToHex(h, 20, 20);
  const borderStrong  = hslToHex(h, 20, 26);

  // Dark mode inputs / cards / tables / dropdowns
  const inputBg       = hslToHex(h, 18, 16);
  const inputBorder   = hslToHex(h, 20, 20);
  const cardBg        = hslToHex(h, 18, 13);
  const cardBorder    = hslToHex(h, 20, 16);
  const tableHdrBg    = hslToHex(h, 20, 15);
  const tableHover    = hslToHex(h, 20, 16);
  const tableBorder   = hslToHex(h, 20, 16);
  const dropdownBg    = hslToHex(h, 18, 16);
  const dropdownBord  = hslToHex(h, 20, 20);
  const dropdownHover = hslToHex(h, 20, 21);

  const ra = (a: number) => hexToRgba(primaryHex, a);

  return `/* tenant-theme: ${primaryHex} */

/* ── Brand scale + shared structural colors ───────────────────── */
:root {
  --wine-50:  ${scale['50']};
  --wine-100: ${scale['100']};
  --wine-200: ${scale['200']};
  --wine-300: ${scale['300']};
  --wine-400: ${scale['400']};
  --wine-500: ${scale['500']};
  --wine-600: ${scale['600']};
  --wine-700: ${scale['700']};
  --wine-800: ${scale['800']};
  --wine-900: ${scale['900']};

  /* Sidebar — light in light mode */
  --sidebar-bg:            var(--surface-base);
  --sidebar-border:        var(--border-subtle);
  --sidebar-text:          var(--text-secondary);
  --sidebar-text-hover:    var(--text-primary);
  --sidebar-hover:         rgba(0,0,0,0.04);
  --sidebar-active-bg:     ${scale['50']};
  --sidebar-active-text:   ${scale['700']};
  --sidebar-section-label: var(--text-tertiary);

  /* Navbar — light in light mode */
  --navbar-bg:             var(--surface-base);
  --navbar-border:         var(--border-subtle);

  /* Light mode brand-linked status / tasks / banners */
  --status-info:           ${primaryHex};
  --status-info-bg:        ${ra(0.08)};
  --status-info-border:    ${ra(0.20)};
  --status-warning:        ${primaryHex};
  --status-warning-bg:     ${scale['50']};
  --status-warning-border: ${ra(0.18)};
  --info-banner-bg:        ${scale['50']};
  --info-banner-border:    ${primaryHex};
  --info-banner-text:      ${scale['700']};

  --task-assigned:         ${primaryHex};
  --task-assigned-bg:      ${scale['50']};
  --task-assigned-border:  ${ra(0.28)};
  --task-accepted:         ${primaryHex};
  --task-accepted-bg:      ${scale['50']};
  --task-accepted-border:  ${ra(0.28)};
  --task-in_progress:      ${primaryHex};
  --task-in_progress-bg:   ${scale['50']};
  --task-in_progress-border:${ra(0.28)};
  --task-submitted:        ${primaryHex};
  --task-submitted-bg:     ${scale['50']};
  --task-submitted-border: ${ra(0.28)};
  --task-review:           ${primaryHex};
  --task-review-bg:        ${scale['50']};
  --task-review-border:    ${ra(0.28)};
  --task-approved:         ${primaryHex};
  --task-approved-bg:      ${scale['50']};
  --task-approved-border:  ${ra(0.28)};
}

/* ── Dark mode — everything ────────────────────────────────────── */
[data-theme="dark"] {
  /* Brand scale (dark-mode adjusted) */
  --wine-300: ${darkHover};
  --wine-400: ${darkActive};
  --wine-500: ${primaryHex};

  /* Page surfaces */
  --surface-app:       ${surfaceApp};
  --surface-base:      ${surfaceBase};
  --surface-raised:    ${surfaceRaised};
  --surface-overlay:   ${surfaceOverlay};
  --surface-subtle:    ${surfaceSubtle};
  --surface-inset:     ${surfaceBase};
  --surface-primary:   ${surfaceBase};
  --surface-secondary: ${surfaceOverlay};

  /* Borders */
  --border-subtle:     ${borderSubtle};
  --border-default:    ${borderDefault};
  --border-strong:     ${borderStrong};
  --border-focus:      ${darkActive};

  /* Brand tokens */
  --brand:             ${darkActive};
  --brand-hover:       ${darkHover};
  --brand-active:      ${darkHover};
  --brand-subtle:      ${ra(0.12)};
  --brand-muted:       ${ra(0.22)};
  --text-brand:        ${darkActive};

  /* Sidebar */
  --sidebar-bg:            ${sidebarBg};
  --sidebar-border:        ${sidebarBorder};
  --sidebar-text:          ${sidebarText};
  --sidebar-text-hover:    ${sidebarTextHov};
  --sidebar-active-bg:     ${ra(0.12)};
  --sidebar-active-text:   ${darkActive};
  --sidebar-section-label: ${sidebarSection};

  /* Navbar */
  --navbar-bg:             ${navbarBg};
  --navbar-border:         ${navbarBorder};

  /* Inputs */
  --input-bg:              ${inputBg};
  --input-border:          ${inputBorder};
  --input-focus-border:    ${darkActive};
  --input-focus-ring:      ${ra(0.18)};

  /* Cards */
  --card-bg:               ${cardBg};
  --card-border:           ${cardBorder};

  /* Tables */
  --table-header-bg:       ${tableHdrBg};
  --table-header-text:     ${sidebarText};
  --table-row-hover:       ${tableHover};
  --table-border:          ${tableBorder};

  /* Dropdowns */
  --dropdown-bg:           ${dropdownBg};
  --dropdown-border:       ${dropdownBord};
  --dropdown-item-hover:   ${dropdownHover};
  --dropdown-item-active:  ${ra(0.15)};

  /* Status */
  --status-info:           ${darkActive};
  --status-info-bg:        ${ra(0.10)};
  --status-info-border:    ${ra(0.22)};
  --status-warning:        ${darkActive};
  --status-warning-bg:     ${ra(0.12)};
  --status-warning-border: ${ra(0.24)};

  /* Info banner */
  --info-banner-bg:        ${ra(0.10)};
  --info-banner-border:    ${darkActive};
  --info-banner-text:      ${darkActive};

  /* Tasks (brand-linked states) */
  --task-assigned:         ${darkActive};
  --task-assigned-bg:      ${ra(0.12)};
  --task-assigned-border:  ${ra(0.28)};
  --task-accepted:         ${darkActive};
  --task-accepted-bg:      ${ra(0.12)};
  --task-accepted-border:  ${ra(0.28)};
  --task-in_progress:      ${darkActive};
  --task-in_progress-bg:   ${ra(0.12)};
  --task-in_progress-border:${ra(0.28)};
  --task-submitted:        ${darkActive};
  --task-submitted-bg:     ${ra(0.12)};
  --task-submitted-border: ${ra(0.28)};
  --task-review:           ${darkActive};
  --task-review-bg:        ${ra(0.12)};
  --task-review-border:    ${ra(0.28)};
  --task-approved:         ${darkActive};
  --task-approved-bg:      ${ra(0.12)};
  --task-approved-border:  ${ra(0.28)};

  /* Legacy aliases */
  --bg-primary:            ${surfaceBase};
  --bg-secondary:          ${surfaceApp};
  --bg-tertiary:           ${surfaceSubtle};
  --border-primary:        ${borderSubtle};
  --border-secondary:      ${borderDefault};
  --color-orange-500:      ${darkActive};
  --color-orange-600:      ${primaryHex};
  --brand-orange:          ${darkActive};
  --brand-orange-hover:    ${darkHover};
  --primary:               ${darkActive};
  --primary-hover:         ${darkHover};
  --ring:                  ${darkActive};
  --hover-surface:         ${surfaceSubtle};
  --accent:                ${surfaceSubtle};
  --secondary:             ${surfaceSubtle};
  --secondary-hover:       ${borderSubtle};
  --muted:                 ${cardBg};
  --background:            ${surfaceApp};
  --border:                ${borderSubtle};
}`;
}

export function applyTenantTheme(primaryHex: string): void {
  if (typeof document === 'undefined') return;
  const css = buildThemeCss(primaryHex);
  if (!css) return;
  let el = document.getElementById('tenant-theme') as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = 'tenant-theme';
    document.head.appendChild(el);
  }
  el.textContent = css;
}
