export const USER_STAMPS: Record<string, string> = {
  abdel: '/stamps/abdo-stamp.svg',
  sayed: '/stamps/sayed-stamp.svg',
  noura: '/stamps/noura-stamp.svg',
  saif:  '/stamps/saif-stamp.svg',
};

export function resolveStamp(u: string | null | undefined): string | null {
  if (!u) return null;
  const k = u.toLowerCase();
  for (const name of Object.keys(USER_STAMPS)) {
    if (k.includes(name)) return USER_STAMPS[name];
  }
  return null;
}
