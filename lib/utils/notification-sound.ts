/**
 * Notification sound system — Web Audio API, no external files.
 * Plays pleasant notification sounds like WhatsApp.
 */

const STORAGE_KEY = 'erb_sound_muted';

function isSoundMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

type SoundVariant = 'notification' | 'task' | 'alert';

function scheduleNote(
  ctx: AudioContext,
  freq: number,
  start: number,
  duration: number,
  vol = 0.25,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vol, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/**
 * Play a notification sound.
 * Falls back silently if AudioContext is unavailable (e.g. SSR, blocked policy).
 */
export function playNotificationSound(variant: SoundVariant = 'notification'): void {
  if (isSoundMuted()) return;
  if (typeof window === 'undefined') return;

  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();

    const t = ctx.currentTime;

    if (variant === 'notification') {
      // WhatsApp-style double ding: G5 → C6
      scheduleNote(ctx, 783.99,  t,        0.18, 0.28);
      scheduleNote(ctx, 1046.50, t + 0.14, 0.22, 0.22);
    } else if (variant === 'task') {
      // Softer single ping for task updates
      scheduleNote(ctx, 880, t, 0.2, 0.18);
    } else if (variant === 'alert') {
      // Triple ding for urgent
      scheduleNote(ctx, 659.25,  t,        0.12, 0.28);
      scheduleNote(ctx, 783.99,  t + 0.10, 0.12, 0.24);
      scheduleNote(ctx, 1046.50, t + 0.20, 0.22, 0.28);
    }
  } catch {
    // AudioContext blocked (autoplay policy etc.) — silently ignored
  }
}
