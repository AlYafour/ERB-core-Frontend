'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrSelfAttendanceApi, hrRequestsApi, type BiometricProof } from '@/lib/api/hr';
import type { MissingPunch } from '@/types';
import { Loader } from '@/components/ui';
import { toast } from '@/lib/hooks/use-toast';
import {
  isPlatformAuthenticatorAvailable,
  prepareAuthenticationOptions,
  serializeAuthenticationCredential,
} from '@/lib/utils/webauthn';

interface Props {
  emp: any;
  isSelf: boolean;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Whole minutes from `now` until an "HH:MM" wall-clock time today (can be negative).
function minsUntil(hhmm: string | undefined, now: Date): number | null {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

function fmtHours(h: number | null | undefined): string {
  if (h == null) return '—';
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
}

// Label/value row used inside the late-return acknowledge screen.
function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span>{label}</span>
      <span style={{ fontWeight: strong ? 700 : 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function getPosition(highAccuracy: boolean, timeout: number, maxAge: number): Promise<GeolocationCoordinates | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos.coords),
      () => resolve(null),
      { timeout, maximumAge: maxAge, enableHighAccuracy: highAccuracy },
    );
  });
}

// Stable per-browser device id (localStorage). Sent with every punch so the
// trusted-device verification layer can bind punches to a known device — the
// anti-buddy-punching signal. The mobile app supplies its own native UUID.
function getDeviceUuid(): string {
  try {
    const KEY = 'erb_device_uuid';
    let v = localStorage.getItem(KEY);
    if (!v) {
      v = (crypto?.randomUUID?.() ?? `web-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(KEY, v);
    }
    return v;
  } catch {
    return '';
  }
}

// Two-stage acquisition: try the precise GPS chip first (short wait), then fall
// back to fast network / Wi-Fi location. The fallback is what makes check-in
// work INDOORS (weak GPS) and on DESKTOPS (no GPS chip at all) — the previous
// GPS-only + no-cache setup silently timed out there. The device also reports
// `coords.accuracy` (metres), which the server uses so two phones at the same
// spot with different GPS error still agree.
async function getLocation(): Promise<GeolocationCoordinates | null> {
  const precise = await getPosition(true, 8000, 0);
  if (precise) return precise;
  return getPosition(false, 12000, 60000);
}

// Compute work hours from timestamps (live estimate before checkout)
function computeWorkHours(record: any): number | null {
  if (!record?.check_in) return null;
  const ci = new Date(record.check_in).getTime();
  const co = record.check_out ? new Date(record.check_out).getTime() : Date.now();
  let ms = co - ci;
  if (record.break_start && record.break_end) {
    ms -= new Date(record.break_end).getTime() - new Date(record.break_start).getTime();
  }
  return Math.max(0, ms) / 3_600_000;
}

// ── Timeline track helpers ─────────────────────────────────────────────────────
function toMins(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function buildTimelineWindow(record: any): { startM: number; endM: number; ticks: string[] } {
  const ci = toMins(record?.check_in);
  const co = record?.check_out ? toMins(record.check_out) : null;
  const now = new Date().getHours() * 60 + new Date().getMinutes();

  const dataStart = ci ?? 7 * 60;
  const dataEnd   = co ?? (record?.check_in ? now : 17 * 60);

  // Round start down to nearest hour, clamp max 1 hour before first event.
  const startM = Math.floor(Math.max(0, dataStart - 60) / 60) * 60;
  // Round end up to nearest hour, at least 1 hour after last event.
  const rawEnd = Math.ceil((dataEnd + 60) / 60) * 60;
  const endM   = Math.max(rawEnd, startM + 2 * 60); // minimum 2-hour window

  // Generate 5–7 evenly-spaced tick labels.
  const span  = endM - startM;
  const step  = span <= 360 ? 60 : span <= 720 ? 120 : 180;
  const ticks: string[] = [];
  for (let m = startM; m <= endM; m += step) {
    const h  = Math.floor(m / 60) % 24;
    const mm = m % 60;
    ticks.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  return { startM, endM, ticks };
}

function toPct(iso: string | null | undefined, fallbackMins: number | undefined, startM: number, span: number): number {
  let mins: number;
  if (iso) {
    const d = new Date(iso);
    mins = d.getHours() * 60 + d.getMinutes();
  } else if (fallbackMins !== undefined) {
    mins = fallbackMins;
  } else {
    return 0;
  }
  return Math.max(0, Math.min(100, ((mins - startM) / span) * 100));
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ClockingCard({ emp, isSelf }: Props) {
  const queryClient = useQueryClient();
  const [gpsError, setGpsError]   = useState<string | null>(null);
  const [gettingGps, setGettingGps] = useState(false);
  const [verifying, setVerifying] = useState(false);
  // Emergency-exit form (config + limits come entirely from punch-status).
  const [showEmergency, setShowEmergency] = useState(false);
  const [emReason, setEmReason] = useState('');
  const [emAck, setEmAck] = useState(false);
  // Missing-punch one-tap correction: which gap is being fixed + its edited time.
  const [fixing, setFixing] = useState<MissingPunch | null>(null);
  const [fixTime, setFixTime] = useState('');
  // Late return from break: the yellow acknowledge screen before self-recording.
  const [showLateBreak, setShowLateBreak] = useState(false);
  // Live wall clock (ticks every second) — powers the on-screen clock + the
  // "opens/closes in X min" countdown next to each punch button.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  // Fingerprint (WebAuthn) is optional: only offered where the OS supports it
  // (Windows Hello / Touch ID). hasPasskey is discovered lazily on first use.
  const [platformAvail, setPlatformAvail] = useState(false);
  const [hasPasskey, setHasPasskey] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isSelf) return;
    let alive = true;
    isPlatformAuthenticatorAvailable().then(a => { if (alive) setPlatformAvail(a); });
    return () => { alive = false; };
  }, [isSelf]);

  /**
   * Attempt an optional fingerprint verification for a clock event.
   * Returns the assertion to attach, or null to clock manually (never blocks).
   * `hadPasskey` distinguishes "not enrolled" (silent manual) from
   * "enrolled but fingerprint didn't complete" (manual + a heads-up toast).
   */
  async function tryFingerprint(): Promise<{ proof: BiometricProof | null; hadPasskey: boolean }> {
    if (!platformAvail) return { proof: null, hadPasskey: false };
    setVerifying(true); // lock the buttons for the WHOLE flow, incl. the begin round-trip
    try {
      let begin: { options: Record<string, unknown>; challenge_token: string };
      try {
        begin = await hrSelfAttendanceApi.biometricBegin();
        setHasPasskey(true);
      } catch (err: any) {
        // 400 = no fingerprint registered on this account → clock manually + nudge.
        if (err?.response?.status === 400) setHasPasskey(false);
        return { proof: null, hadPasskey: false };
      }
      try {
        const options = prepareAuthenticationOptions(begin.options);
        const cred = (await navigator.credentials.get({ publicKey: options })) as PublicKeyCredential | null;
        if (!cred) return { proof: null, hadPasskey: true };
        return {
          proof: { webauthn: serializeAuthenticationCredential(cred), challenge_token: begin.challenge_token },
          hadPasskey: true,
        };
      } catch {
        return { proof: null, hadPasskey: true }; // cancelled / failed → manual fallback
      }
    } finally {
      setVerifying(false);
    }
  }

  const { data: record, isLoading } = useQuery({
    queryKey: ['attendance-today', emp?.id],
    queryFn:  () => hrSelfAttendanceApi.getToday(emp!.id),
    enabled:  !!emp,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance-today', emp?.id] });
    queryClient.invalidateQueries({ queryKey: ['punch-status', emp?.id] });
  };

  const checkInMut = useMutation({
    mutationFn: (data: { latitude: number; longitude: number; accuracy?: number; device_uuid?: string } & Partial<BiometricProof>) => hrSelfAttendanceApi.checkIn(data),
    onSuccess: (rec) => { invalidate(); toast(rec.check_in_method === 'biometric' ? 'Checked in — verified by fingerprint.' : 'Checked in successfully.', 'success'); },
    onError:   (err: any) => setGpsError(err?.response?.data?.detail ?? 'Check-in failed.'),
    throwOnError: false,
  });

  const checkOutMut = useMutation({
    mutationFn: (data?: { latitude?: number; longitude?: number; accuracy?: number; device_uuid?: string } & Partial<BiometricProof>) => hrSelfAttendanceApi.checkOut(data),
    onSuccess: (rec) => { invalidate(); toast(rec.check_out_method === 'biometric' ? 'Checked out — verified by fingerprint.' : 'Checked out successfully.', 'success'); },
    onError:   (err: any) => setGpsError(err?.response?.data?.detail ?? 'Check-out failed.'),
    throwOnError: false,
  });

  const breakOutMut = useMutation({
    mutationFn: (data?: { latitude?: number; longitude?: number; accuracy?: number; device_uuid?: string }) => hrSelfAttendanceApi.breakOut(data),
    onSuccess: () => { invalidate(); toast('Break started.', 'success'); },
    onError:   (err: any) => setGpsError(err?.response?.data?.detail ?? 'Failed to start break.'),
    throwOnError: false,
  });

  const breakInMut = useMutation({
    mutationFn: (data?: { latitude?: number; longitude?: number; accuracy?: number; device_uuid?: string; late_ack?: boolean }) => hrSelfAttendanceApi.breakIn(data),
    onSuccess: (rec: any) => {
      // Past the deadline the server asks the employee to acknowledge first —
      // show the yellow "late return" screen instead of recording silently.
      if (rec?.requires_ack) { setShowLateBreak(true); return; }
      setShowLateBreak(false);
      invalidate();
      toast(rec?.break_end_late ? 'Late return recorded — noted on your day.' : 'Break ended — welcome back.', 'success');
    },
    onError:   (err: any) => setGpsError(err?.response?.data?.detail ?? 'Failed to end break.'),
    throwOnError: false,
  });

  // Punch-status carries the emergency-exit config + monthly counter, all
  // policy-driven. Refetched after any punch so the counter/pending stay fresh.
  const { data: punch } = useQuery({
    queryKey: ['punch-status', emp?.id],
    queryFn:  () => hrSelfAttendanceApi.punchStatus(),
    enabled:  !!emp && isSelf,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
  const em = punch?.emergency;

  const emergencyMut = useMutation({
    mutationFn: (data: { reason: string; ack: boolean }) => hrSelfAttendanceApi.emergencyExit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punch-status', emp?.id] });
      setShowEmergency(false); setEmReason(''); setEmAck(false);
      toast('Emergency exit approved — you may now clock out.', 'success');
    },
    onError: (err: any) => setGpsError(err?.response?.data?.detail ?? 'Emergency request failed.'),
    throwOnError: false,
  });

  // Prior incomplete days (forgot to clock out / end break) — one-tap correction.
  const { data: missing } = useQuery({
    queryKey: ['missing-punches', emp?.id],
    queryFn:  () => hrSelfAttendanceApi.missingPunches(),
    enabled:  !!emp && isSelf,
    staleTime: 5 * 60_000,
  });

  const fixMut = useMutation({
    mutationFn: (g: MissingPunch & { time: string }) => hrRequestsApi.create({
      request_type: 'missing_punch', start_date: g.date,
      punch_kind: g.kind, start_time: g.time,
      reason: g.label,
    } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missing-punches', emp?.id] });
      queryClient.invalidateQueries({ queryKey: ['punch-status', emp?.id] });
      setFixing(null); setFixTime('');
      toast('Correction submitted for approval.', 'success');
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? 'Could not submit the correction.', 'error'),
    throwOnError: false,
  });

  // Break punches must also be at the work site — capture location like check-in.
  const doBreakIn = async (lateAck: boolean) => {
    setGpsError(null);
    setGettingGps(true);
    const coords = await getLocation();
    setGettingGps(false);
    const base = { device_uuid: getDeviceUuid(), ...(coords ? { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy } : {}) };
    breakInMut.mutate({ ...base, ...(lateAck ? { late_ack: true } : {}) });
  };

  const handleBreak = async (which: 'out' | 'in') => {
    if (which === 'in') {
      // Returned after the deadline → acknowledge on the yellow screen first,
      // then it self-records (flagged late + retroactive). No manager approval.
      // Follows the break deadline (break_end.open_now), independent of the
      // check-in/out window toggle.
      if (punch?.break_end && punch.break_end.open_now === false) {
        setGpsError(null);
        setShowLateBreak(true);
        return;
      }
      return doBreakIn(false);
    }
    setGpsError(null);
    setGettingGps(true);
    const coords = await getLocation();
    setGettingGps(false);
    const base = { device_uuid: getDeviceUuid(), ...(coords ? { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy } : {}) };
    breakOutMut.mutate(base);
  };

  const handleCheckIn = async () => {
    setGpsError(null);
    if (checkedIn) { setGpsError('You have already clocked in today.'); return; }
    setGettingGps(true);
    const coords = await getLocation();
    setGettingGps(false);
    if (!coords) { setGpsError('Could not get your location. Please enable GPS and try again.'); return; }
    const { proof, hadPasskey } = await tryFingerprint();
    if (hadPasskey && !proof) toast('Fingerprint not verified — clocking in without it.', 'info');
    checkInMut.mutate({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, device_uuid: getDeviceUuid(), ...(proof ?? {}) });
  };

  const handleCheckOut = async () => {
    setGpsError(null);
    if (checkedOut) { setGpsError('Your shift is already complete for today.'); return; }
    if (!checkedIn) { setGpsError('Please clock in before clocking out.'); return; }
    setGettingGps(true);
    const coords = await getLocation();
    setGettingGps(false);
    const { proof, hadPasskey } = await tryFingerprint();
    if (hadPasskey && !proof) toast('Fingerprint not verified — clocking out without it.', 'info');
    const base = { device_uuid: getDeviceUuid(), ...(coords ? { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy } : {}) };
    checkOutMut.mutate({ ...base, ...(proof ?? {}) });
  };

  const busy       = gettingGps || verifying || checkInMut.isPending || checkOutMut.isPending || breakOutMut.isPending || breakInMut.isPending;
  const checkedIn  = !!record?.check_in;
  const checkedOut = !!record?.check_out;
  const isOnBreak  = !!record?.break_start && !record?.break_end;

  // Per-button time windows (from punch-status). When enforcement is off the
  // server returns open_now:true, so nothing locks. A valid emergency exit
  // overrides the check-out window. `opens`/`closes` drive the locked label.
  const ciLocked  = punch?.check_in ? !punch.check_in.open_now : false;
  const brkLocked = punch?.break_start ? !punch.break_start.open_now : false;
  const coLocked  = punch?.check_out ? (!punch.check_out.open_now && !em?.has_pending) : false;

  // Countdown hint for the button that matters right now: how long until the
  // relevant window opens (locked) or closes (open, closing soon). Only shown
  // when windows are enforced.
  const windowHint = (() => {
    if (!isSelf || !punch?.enforced) return null;
    const w = !checkedIn ? punch.check_in : (checkedIn && !checkedOut ? punch.check_out : null);
    const label = !checkedIn ? 'Check-in' : 'Check-out';
    if (!w) return null;
    if (!w.open_now) {
      const o = minsUntil(w.opens, now);
      if (o != null && o > 0 && o <= 180) return { text: `${label} opens in ${o} min`, warn: false };
      return null;
    }
    const c = minsUntil(w.closes, now);
    if (c != null && c > 0 && c <= 10) return { text: `⏳ ${label} closes in ${c} min`, warn: true };
    if (c != null && c > 0) return { text: `${label} open until ${w.closes}`, warn: false };
    return null;
  })();

  // ── Status pill ────────────────────────────────────────────────────────────
  const statusCfg = !checkedIn
    ? { label: 'Not started',                                     bg: 'var(--surface-subtle)', color: 'var(--text-secondary)', dot: 'var(--text-tertiary)', pulse: false }
    : isOnBreak
    ? { label: `On break · ${fmtTime(record?.break_start)}`,      bg: '#FEF3C7', color: '#B45309', dot: '#B45309', pulse: false }
    : checkedOut
    ? { label: 'Shift complete',                                   bg: '#DCFCE7', color: '#166534', dot: '#16a34a', pulse: false }
    : { label: 'Working',                                          bg: 'var(--brand-subtle)', color: 'var(--brand)', dot: 'var(--brand)', pulse: true };

  // ── Timeline track ─────────────────────────────────────────────────────────
  const { startM, endM, ticks } = buildTimelineWindow(record);
  const span    = endM - startM;
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const ciPct   = toPct(record?.check_in,   undefined, startM, span);
  const brkSPct = toPct(record?.break_start, undefined, startM, span);
  const brkEPct = toPct(record?.break_end,   undefined, startM, span);
  const endPct  = record?.check_out
    ? toPct(record.check_out, undefined, startM, span)
    : toPct(undefined, nowMins, startM, span);
  const hasBrk  = !!record?.break_start;
  const brkDone = hasBrk && !!record?.break_end;

  // Work hours (live estimate when not yet checked out)
  const displayHours = record?.work_hours != null
    ? (record.work_hours as number)
    : computeWorkHours(record);

  const trackLabel = checkedOut
    ? `${fmtHours(displayHours)} worked`
    : isOnBreak
    ? 'On break'
    : checkedIn
    ? `${fmtHours(displayHours)} so far`
    : '';

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 24,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.04)',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes clock-dot-pulse {
          0%, 100% { opacity:1; transform:scale(1); }
          50%       { opacity:.45; transform:scale(1.5); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 24px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Today&apos;s Clocking</span>
          {isSelf && (
            <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--brand)', fontFamily: 'var(--font-mono, monospace)' }}>
              {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
          )}
          {isSelf && punch?.zone && (() => {
            const z = { green: '#16a34a', yellow: '#CA8A04', orange: '#EA580C', red: '#DC2626' }[punch.zone];
            return <span title={`Attendance zone this month${punch.score != null ? ` · ${punch.score} pts` : ''}`}
              style={{ width: 10, height: 10, borderRadius: '50%', background: z, flexShrink: 0, boxShadow: `0 0 0 3px ${z}22` }} />;
          })()}
        </span>
        {emp && !isLoading && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 999, background: statusCfg.bg, color: statusCfg.color }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusCfg.dot, flexShrink: 0, animation: statusCfg.pulse ? 'clock-dot-pulse 1.8s ease-in-out infinite' : 'none' }} />
            {statusCfg.label}
          </span>
        )}
      </div>

      {!emp && (
        <div style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>No employee profile is linked to your account.</p>
        </div>
      )}

      {emp && isLoading && <div style={{ padding: '24px' }}><Loader /></div>}

      {emp && !isLoading && (
        <>
          {/* Missing-punch banner — prior days started but never completed */}
          {isSelf && (missing?.length ?? 0) > 0 && (
            <div style={{ margin: '16px 24px 0', padding: '12px 14px', borderRadius: 14, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#92400E', margin: '0 0 8px' }}>
                🧩 {missing!.length} incomplete {missing!.length === 1 ? 'day' : 'days'} — fix in one tap
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {missing!.map(g => (
                  <div key={`${g.date}-${g.kind}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 12, color: '#78350F' }}>
                    <span>{new Date(g.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })} · {g.label}</span>
                    <button onClick={() => { setFixing(g); setFixTime(g.suggested_time ?? g.shift_end ?? ''); }}
                      style={{ height: 30, padding: '0 14px', borderRadius: 999, border: 'none', background: '#B45309', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                      Fix
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* IN → BREAK → OUT */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'center', padding: '20px 24px 16px' }}>

            {/* Check In */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '0 0 4px' }}>Check In</p>
              <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: checkedIn ? 'var(--text-primary)' : 'var(--border-default)', margin: 0, lineHeight: 1 }}>
                {fmtTime(record?.check_in)}
              </p>
              {record?.check_in_method === 'biometric' && (
                <span title="Verified by fingerprint" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 5, fontSize: 10, fontWeight: 700, color: '#16a34a' }}>🔒 Fingerprint</span>
              )}
            </div>

            <span style={{ padding: '0 10px', color: 'var(--border-default)', fontSize: 20, userSelect: 'none' }}>›</span>

            {/* Break */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '0 0 4px' }}>Break</p>
              {record?.break_start ? (
                <p style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#B45309', margin: 0, lineHeight: 1, whiteSpace: 'nowrap' }}>
                  {fmtTime(record.break_start)}{record.break_end ? `–${fmtTime(record.break_end)}` : '…'}
                </p>
              ) : (
                <p style={{ fontSize: 20, fontWeight: 600, color: 'var(--border-default)', margin: 0, lineHeight: 1 }}>—</p>
              )}
            </div>

            <span style={{ padding: '0 10px', color: 'var(--border-default)', fontSize: 20, userSelect: 'none' }}>›</span>

            {/* Check Out */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '0 0 4px' }}>Check Out</p>
              <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: checkedOut ? 'var(--text-primary)' : 'var(--border-default)', margin: 0, lineHeight: 1 }}>
                {fmtTime(record?.check_out)}
              </p>
              {record?.check_out_method === 'biometric' && (
                <span title="Verified by fingerprint" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 5, fontSize: 10, fontWeight: 700, color: '#16a34a' }}>🔒 Fingerprint</span>
              )}
            </div>
          </div>

          {/* Timeline track — only shown after clock-in */}
          {checkedIn && (
            <div style={{ padding: '0 24px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                {ticks.map(t => (
                  <span key={t} style={{ fontSize: 10, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{t}</span>
                ))}
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-subtle)', position: 'relative', overflow: 'hidden' }}>
                {/* Worked segment before break (or full segment if no break) */}
                <div style={{
                  position: 'absolute', top: 0, bottom: 0,
                  left: `${ciPct}%`,
                  width: `${(hasBrk ? brkSPct : endPct) - ciPct}%`,
                  background: 'var(--brand)',
                  borderRadius: 999,
                }} />
                {/* Break gap (card bg shows through) */}
                {hasBrk && (
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${brkSPct}%`,
                    width: `${(brkDone ? brkEPct : endPct) - brkSPct}%`,
                    background: 'var(--card-bg)',
                  }} />
                )}
                {/* Post-break segment (dimmer) */}
                {brkDone && (
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${brkEPct}%`,
                    width: `${endPct - brkEPct}%`,
                    background: 'var(--brand)',
                    opacity: 0.5,
                    borderRadius: 999,
                  }} />
                )}
              </div>
              {trackLabel && (
                <p style={{ fontSize: 12, fontWeight: 600, margin: '7px 0 0', textAlign: 'right', color: isOnBreak ? '#B45309' : 'var(--brand)' }}>
                  {trackLabel}
                </p>
              )}
            </div>
          )}

          {/* Out-of-range notice */}
          {record?.is_out_of_range && (
            <div style={{ margin: '0 24px 12px', padding: '8px 14px', borderRadius: 12, background: '#FEF3C7', color: '#B45309', fontSize: 12, border: '1px solid #FDE68A' }}>
              Checked in outside assigned location
            </div>
          )}

          {/* GPS / API error */}
          {gpsError && (
            <div style={{ margin: '0 24px 12px', padding: '10px 14px', borderRadius: 12, background: '#FEF2F2', color: '#991B1B', fontSize: 12, lineHeight: 1.5, border: '1px solid #FECACA' }}>
              {gpsError}
            </div>
          )}

          {/* Window countdown hint */}
          {windowHint && (
            <div style={{ padding: '0 24px 10px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: windowHint.warn ? '#B45309' : 'var(--text-secondary)' }}>
                {windowHint.text}
              </span>
            </div>
          )}

          {/* Action buttons */}
          {isSelf && (
            <div style={{ padding: '0 24px 22px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>

              {/* Only the AVAILABLE button shows — a button outside its window is
                  hidden (the countdown hint above says when it opens). */}
              {!checkedIn && !ciLocked && (
                <button onClick={handleCheckIn} disabled={busy}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 24px', borderRadius: 999, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, background: 'var(--brand)', color: '#fff', opacity: busy ? 0.65 : 1, transition: 'opacity .15s' }}>
                  {gettingGps ? '⏳ Locating…' : verifying ? '🔒 Verifying…' : checkInMut.isPending ? '⏳ Saving…' : '⏱ Clock In'}
                </button>
              )}

              {/* Take a break — only while working and not already on/after a break. */}
              {checkedIn && !checkedOut && !isOnBreak && !record?.break_start && !brkLocked && (
                <button onClick={() => handleBreak('out')} disabled={busy}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 20px', borderRadius: 999, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, background: '#FEF3C7', color: '#B45309', opacity: busy ? 0.55 : 1 }}>
                  {breakOutMut.isPending ? '…' : '⏸ Take a break'}
                </button>
              )}

              {isOnBreak && (() => {
                const breakLate = punch?.break_end?.open_now === false;
                return (
                  <button onClick={() => handleBreak('in')} disabled={busy}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 24px', borderRadius: 999, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, background: breakLate ? '#FDE68A' : '#FEF3C7', color: '#B45309', opacity: busy ? 0.65 : 1 }}>
                    {breakInMut.isPending ? '…' : breakLate ? '⚠ Record late return' : '▶ End break'}
                  </button>
                );
              })()}

              {/* Clock Out is available whenever checked-in and within its
                  window — INCLUDING while on an unfinished break — so nobody is
                  trapped if the break-end deadline passes. Leaving with an open
                  break just becomes a missing-punch correction, which the
                  server already accepts. */}
              {checkedIn && !checkedOut && !coLocked && (
                <button onClick={handleCheckOut} disabled={busy}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 20px', borderRadius: 999, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, background: 'var(--brand)', color: '#fff', opacity: busy ? 0.65 : 1 }}>
                  {gettingGps ? '⏳ Locating…' : verifying ? '🔒 Verifying…' : checkOutMut.isPending ? '⏳ Saving…' : '✓ Clock Out'}
                </button>
              )}

              {/* Emergency exit — a genuine leave-now escape hatch. Shown while
                  working (or on break) when the policy enables it and the
                  employee still has monthly allowance. All limits are server-set. */}
              {checkedIn && !checkedOut && em?.enabled && (
                em.has_pending ? (
                  <span style={{ flexBasis: '100%', fontSize: 12, color: '#B45309', fontWeight: 600 }}>
                    🚨 Emergency exit active — valid until {em.pending_valid_until}. You may clock out.
                  </span>
                ) : (em.remaining ?? 0) > 0 ? (
                  <button onClick={() => { setGpsError(null); setShowEmergency(true); }} disabled={busy}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 18px', borderRadius: 999, border: '1px solid #FECACA', cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, background: '#FEF2F2', color: '#991B1B', opacity: busy ? 0.55 : 1 }}>
                    🚨 Emergency exit
                  </button>
                ) : (
                  <span style={{ flexBasis: '100%', fontSize: 12, color: 'var(--text-tertiary)' }}>
                    No emergency exits left this month ({em.used_this_month}/{em.monthly_limit}).
                  </span>
                )
              )}

              {checkedOut && (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  Great work today — {fmtHours(displayHours)} logged.
                </p>
              )}

              {/* Optional: nudge to register a fingerprint (only if the device
                  supports it and none is registered yet). */}
              {platformAvail && hasPasskey === false && !checkedOut && (
                <Link href="/security" title="Register your fingerprint"
                  style={{ flexBasis: '100%', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>
                  <span>🔒</span> Register your fingerprint to clock in with it →
                </Link>
              )}
            </div>
          )}
        </>
      )}

      {/* Emergency-exit form overlay */}
      {showEmergency && em?.enabled && (() => {
        const minChars = em.min_reason_chars ?? 100;
        const reasonOk = emReason.trim().length >= minChars;
        const canSubmit = reasonOk && emAck && !emergencyMut.isPending;
        return (
          <div onClick={() => !emergencyMut.isPending && setShowEmergency(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: 'var(--card-bg)', borderRadius: 20, maxWidth: 460, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>🚨 Emergency exit</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.6 }}>
                {em.intro_text || 'Use this only for a genuine emergency. It lets you clock out now; the request is logged and reviewed.'}
                {' '}You have {em.remaining} of {em.monthly_limit} left this month, valid for {em.validity_min} minutes.
              </p>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Reason ({minChars}+ characters)
              </label>
              <textarea value={emReason} onChange={e => setEmReason(e.target.value)} rows={4}
                placeholder="Describe the emergency in detail…"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 12, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
              <p style={{ fontSize: 11, color: reasonOk ? '#16a34a' : 'var(--text-tertiary)', margin: '4px 0 14px', textAlign: 'right' }}>
                {emReason.trim().length}/{minChars}
              </p>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginBottom: 18, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <input type="checkbox" checked={emAck} onChange={e => setEmAck(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>{em.ack_text || 'I confirm this is a real emergency and I may be asked to provide supporting documents.'}</span>
              </label>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowEmergency(false)} disabled={emergencyMut.isPending}
                  style={{ height: 40, padding: '0 18px', borderRadius: 999, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={() => emergencyMut.mutate({ reason: emReason.trim(), ack: emAck })} disabled={!canSubmit}
                  style={{ height: 40, padding: '0 22px', borderRadius: 999, border: 'none', background: canSubmit ? '#991B1B' : 'var(--border-default)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
                  {emergencyMut.isPending ? '⏳ Submitting…' : 'Submit & unlock clock-out'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Late-return-from-break acknowledge screen (the yellow confirm) */}
      {showLateBreak && punch?.break_end && (() => {
        const be = punch.break_end!;
        const saving = breakInMut.isPending || gettingGps;
        return (
          <div onClick={() => !saving && setShowLateBreak(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 20, maxWidth: 420, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#92400E', margin: '0 0 14px' }}>📝 Record end of break</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: '#78350F', borderTop: '1px solid #FDE68A', borderBottom: '1px solid #FDE68A', padding: '14px 0', margin: '0 0 14px' }}>
                <Row label="Current time" value={now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} />
                {be.break_start && <Row label="Break started" value={be.break_start} />}
                {/* Deliberately NOT showing the deadline — it would reveal the
                    grace window and be treated as an entitlement. */}
                <Row label="Classification" value="Late return (recorded retroactively)" strong />
                {be.points ? <Row label="Score" value={`−${be.points} points`} strong /> : null}
              </div>
              <p style={{ fontSize: 12, color: '#78350F', margin: '0 0 16px', lineHeight: 1.6 }}>
                You returned after the allowed break time. Confirming records your return now and flags it as a late, retroactive punch — no approval needed.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowLateBreak(false)} disabled={saving}
                  style={{ height: 40, padding: '0 18px', borderRadius: 999, border: '1px solid #FDE68A', background: 'transparent', color: '#92400E', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={() => doBreakIn(true)} disabled={saving}
                  style={{ height: 40, padding: '0 22px', borderRadius: 999, border: 'none', background: '#B45309', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? '⏳ Saving…' : 'OK · Confirm'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Missing-punch correction form */}
      {fixing && (() => {
        const timeOk = /^\d{2}:\d{2}$/.test(fixTime);
        const canFix = timeOk && !fixMut.isPending;
        return (
          <div onClick={() => !fixMut.isPending && setFixing(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: 'var(--card-bg)', borderRadius: 20, maxWidth: 420, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>🧩 Fix missing punch</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.6 }}>
                {fixing.label} on {new Date(fixing.date).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' })}.
                Confirm the time — it&apos;s sent for approval, then written to your attendance.
              </p>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Time
              </label>
              <input type="time" value={fixTime} onChange={e => setFixTime(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 12, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box', marginBottom: 18 }} />

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setFixing(null)} disabled={fixMut.isPending}
                  style={{ height: 40, padding: '0 18px', borderRadius: 999, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={() => fixMut.mutate({ ...fixing, time: fixTime })} disabled={!canFix}
                  style={{ height: 40, padding: '0 22px', borderRadius: 999, border: 'none', background: canFix ? 'var(--brand)' : 'var(--border-default)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: canFix ? 'pointer' : 'not-allowed' }}>
                  {fixMut.isPending ? '⏳ Submitting…' : 'Submit correction'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
