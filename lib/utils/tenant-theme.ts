/* ================================================================
   TENANT THEME UTILITY
   Generates a full CSS variable scale from a single brand hex color.
   Works for both light and dark data-theme contexts.
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
  const [h, s, l] = rgbToHsl(r, g, b);
  const darkActive  = hslToHex(h, clamp(s - 8, 28, 100), clamp(l + 18, 58, 82));
  const darkHover   = hslToHex(h, clamp(s - 5, 28, 100), clamp(l + 27, 65, 86));

  return `/* tenant-theme: ${primaryHex} */
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
  --status-info:        ${primaryHex};
  --status-info-bg:     ${hexToRgba(primaryHex, 0.08)};
  --status-info-border: ${hexToRgba(primaryHex, 0.20)};
}
[data-theme="dark"] {
  --wine-300: ${darkHover};
  --wine-400: ${darkActive};
  --wine-500: ${primaryHex};
  --brand:              ${darkActive};
  --brand-hover:        ${darkHover};
  --brand-subtle:       ${hexToRgba(primaryHex, 0.12)};
  --brand-muted:        ${hexToRgba(primaryHex, 0.22)};
  --border-focus:       ${darkActive};
  --text-brand:         ${darkActive};
  --sidebar-active-bg:  ${hexToRgba(primaryHex, 0.12)};
  --sidebar-active-text:${darkActive};
  --input-focus-border: ${darkActive};
  --input-focus-ring:   ${hexToRgba(primaryHex, 0.18)};
  --primary:            ${darkActive};
  --primary-hover:      ${darkHover};
  --ring:               ${darkActive};
  --status-info:        ${darkActive};
  --status-info-bg:     ${hexToRgba(primaryHex, 0.10)};
  --status-info-border: ${hexToRgba(primaryHex, 0.22)};
  --color-orange-500:   ${darkActive};
  --color-orange-600:   ${primaryHex};
  --brand-orange:       ${darkActive};
  --brand-orange-hover: ${darkHover};
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
