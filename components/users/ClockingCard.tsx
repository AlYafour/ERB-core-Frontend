'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrSelfAttendanceApi } from '@/lib/api/hr';
import { Loader } from '@/components/ui';
import { toast } from '@/lib/hooks/use-toast';

interface Props {
  emp: any;
  isSelf: boolean;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtHours(h: number | null | undefined): string {
  if (h == null) return '—';
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
}

function getLocation(): Promise<GeolocationCoordinates | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos.coords),
      () => resolve(null),
      { timeout: 10000, maximumAge: 30000 },
    );
  });
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
const SHIFT_START_M = 7 * 60;
const SHIFT_END_M   = 17 * 60;
const SHIFT_SPAN_M  = SHIFT_END_M - SHIFT_START_M;

function toShiftPct(iso: string | null | undefined, fallbackMins?: number): number {
  let mins: number;
  if (iso) {
    const d = new Date(iso);
    mins = d.getHours() * 60 + d.getMinutes();
  } else if (fallbackMins !== undefined) {
    mins = fallbackMins;
  } else {
    return 0;
  }
  return Math.max(0, Math.min(100, ((mins - SHIFT_START_M) / SHIFT_SPAN_M) * 100));
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ClockingCard({ emp, isSelf }: Props) {
  const queryClient = useQueryClient();
  const [gpsError, setGpsError]   = useState<string | null>(null);
  const [gettingGps, setGettingGps] = useState(false);

  const { data: record, isLoading } = useQuery({
    queryKey: ['attendance-today', emp?.id],
    queryFn:  () => hrSelfAttendanceApi.getToday(emp!.id),
    enabled:  !!emp,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['attendance-today', emp?.id] });

  const checkInMut = useMutation({
    mutationFn: (coords: { latitude: number; longitude: number }) => hrSelfAttendanceApi.checkIn(coords),
    onSuccess: () => { invalidate(); toast('Checked in successfully.', 'success'); },
    onError:   (err: any) => setGpsError(err?.response?.data?.detail ?? 'Check-in failed.'),
    throwOnError: false,
  });

  const checkOutMut = useMutation({
    mutationFn: (data?: { latitude?: number; longitude?: number }) => hrSelfAttendanceApi.checkOut(data),
    onSuccess: () => { invalidate(); toast('Checked out successfully.', 'success'); },
    onError:   (err: any) => setGpsError(err?.response?.data?.detail ?? 'Check-out failed.'),
    throwOnError: false,
  });

  const breakOutMut = useMutation({
    mutationFn: () => hrSelfAttendanceApi.breakOut(),
    onSuccess: () => { invalidate(); toast('Break started.', 'success'); },
    onError:   (err: any) => setGpsError(err?.response?.data?.detail ?? 'Failed to start break.'),
    throwOnError: false,
  });

  const breakInMut = useMutation({
    mutationFn: () => hrSelfAttendanceApi.breakIn(),
    onSuccess: () => { invalidate(); toast('Break ended — welcome back.', 'success'); },
    onError:   (err: any) => setGpsError(err?.response?.data?.detail ?? 'Failed to end break.'),
    throwOnError: false,
  });

  const handleCheckIn = async () => {
    setGpsError(null);
    if (checkedIn) { setGpsError('You have already clocked in today.'); return; }
    setGettingGps(true);
    const coords = await getLocation();
    setGettingGps(false);
    if (!coords) { setGpsError('Could not get your location. Please enable GPS and try again.'); return; }
    checkInMut.mutate({ latitude: coords.latitude, longitude: coords.longitude });
  };

  const handleCheckOut = async () => {
    setGpsError(null);
    if (checkedOut) { setGpsError('Your shift is already complete for today.'); return; }
    if (!checkedIn) { setGpsError('Please clock in before clocking out.'); return; }
    setGettingGps(true);
    const coords = await getLocation();
    setGettingGps(false);
    checkOutMut.mutate(coords ? { latitude: coords.latitude, longitude: coords.longitude } : undefined);
  };

  const busy       = gettingGps || checkInMut.isPending || checkOutMut.isPending || breakOutMut.isPending || breakInMut.isPending;
  const checkedIn  = !!record?.check_in;
  const checkedOut = !!record?.check_out;
  const isOnBreak  = !!record?.break_start && !record?.break_end;

  // ── Status pill ────────────────────────────────────────────────────────────
  const statusCfg = !checkedIn
    ? { label: 'Not started',                                     bg: '#F0EDEA', color: '#6B6560', dot: '#A8A29E', pulse: false }
    : isOnBreak
    ? { label: `On break · ${fmtTime(record?.break_start)}`,      bg: '#FEF3C7', color: '#B45309', dot: '#B45309', pulse: false }
    : checkedOut
    ? { label: 'Shift complete',                                   bg: '#DCFCE7', color: '#166534', dot: '#16a34a', pulse: false }
    : { label: 'Working',                                          bg: '#F5EEF0', color: 'var(--sidebar-active-bg,#7B1D2E)', dot: 'var(--sidebar-active-bg,#7B1D2E)', pulse: true };

  // ── Timeline track ─────────────────────────────────────────────────────────
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const ciPct   = toShiftPct(record?.check_in);
  const brkSPct = toShiftPct(record?.break_start);
  const brkEPct = toShiftPct(record?.break_end);
  const endPct  = record?.check_out
    ? toShiftPct(record.check_out)
    : toShiftPct(undefined, Math.min(nowMins, SHIFT_END_M));
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
      background: '#fff',
      borderRadius: 24,
      boxShadow: '0 2px 8px rgba(28,25,23,.07), 0 8px 32px rgba(28,25,23,.08)',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes clock-dot-pulse {
          0%, 100% { opacity:1; transform:scale(1); }
          50%       { opacity:.45; transform:scale(1.5); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 24px 16px', borderBottom: '1px solid #F0EDEA' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1917' }}>Today&apos;s Clocking</span>
        {emp && !isLoading && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 999, background: statusCfg.bg, color: statusCfg.color }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusCfg.dot, flexShrink: 0, animation: statusCfg.pulse ? 'clock-dot-pulse 1.8s ease-in-out infinite' : 'none' }} />
            {statusCfg.label}
          </span>
        )}
      </div>

      {!emp && (
        <div style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: 13, color: '#6B6560', margin: 0 }}>No employee profile is linked to your account.</p>
        </div>
      )}

      {emp && isLoading && <div style={{ padding: '24px' }}><Loader /></div>}

      {emp && !isLoading && (
        <>
          {/* IN → BREAK → OUT */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'center', padding: '20px 24px 16px' }}>

            {/* Check In */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#A8A29E', margin: '0 0 4px' }}>Check In</p>
              <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: checkedIn ? '#1C1917' : '#D6D1CC', margin: 0, lineHeight: 1 }}>
                {fmtTime(record?.check_in)}
              </p>
            </div>

            <span style={{ padding: '0 10px', color: '#D6D1CC', fontSize: 20, userSelect: 'none' }}>›</span>

            {/* Break */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#A8A29E', margin: '0 0 4px' }}>Break</p>
              {record?.break_start ? (
                <p style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#B45309', margin: 0, lineHeight: 1, whiteSpace: 'nowrap' }}>
                  {fmtTime(record.break_start)}{record.break_end ? `–${fmtTime(record.break_end)}` : '…'}
                </p>
              ) : (
                <p style={{ fontSize: 20, fontWeight: 600, color: '#D6D1CC', margin: 0, lineHeight: 1 }}>—</p>
              )}
            </div>

            <span style={{ padding: '0 10px', color: '#D6D1CC', fontSize: 20, userSelect: 'none' }}>›</span>

            {/* Check Out */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#A8A29E', margin: '0 0 4px' }}>Check Out</p>
              <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: checkedOut ? '#1C1917' : '#D6D1CC', margin: 0, lineHeight: 1 }}>
                {fmtTime(record?.check_out)}
              </p>
            </div>
          </div>

          {/* Timeline track — only shown after clock-in */}
          {checkedIn && (
            <div style={{ padding: '0 24px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                {['07:00', '09:00', '11:00', '13:00', '15:00', '17:00'].map(t => (
                  <span key={t} style={{ fontSize: 10, color: '#C7C3BF', fontVariantNumeric: 'tabular-nums' }}>{t}</span>
                ))}
              </div>
              <div style={{ height: 8, borderRadius: 999, background: '#EDE9E5', position: 'relative', overflow: 'hidden' }}>
                {/* Worked segment before break (or full segment if no break) */}
                <div style={{
                  position: 'absolute', top: 0, bottom: 0,
                  left: `${ciPct}%`,
                  width: `${(hasBrk ? brkSPct : endPct) - ciPct}%`,
                  background: 'var(--sidebar-active-bg, #7B1D2E)',
                  borderRadius: 999,
                }} />
                {/* Break gap (card bg shows through) */}
                {hasBrk && (
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${brkSPct}%`,
                    width: `${(brkDone ? brkEPct : endPct) - brkSPct}%`,
                    background: '#fff',
                  }} />
                )}
                {/* Post-break segment (dimmer) */}
                {brkDone && (
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${brkEPct}%`,
                    width: `${endPct - brkEPct}%`,
                    background: 'var(--sidebar-active-bg, #7B1D2E)',
                    opacity: 0.5,
                    borderRadius: 999,
                  }} />
                )}
              </div>
              {trackLabel && (
                <p style={{ fontSize: 12, fontWeight: 600, margin: '7px 0 0', textAlign: 'right', color: isOnBreak ? '#B45309' : 'var(--sidebar-active-bg, #7B1D2E)' }}>
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

          {/* Action buttons */}
          {isSelf && (
            <div style={{ padding: '0 24px 22px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>

              {!checkedIn && (
                <button onClick={handleCheckIn} disabled={busy}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 24px', borderRadius: 999, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, background: 'var(--sidebar-active-bg, #7B1D2E)', color: '#fff', opacity: busy ? 0.65 : 1, transition: 'opacity .15s' }}>
                  {gettingGps || checkInMut.isPending ? '⏳ Locating…' : '⏱ Clock In'}
                </button>
              )}

              {checkedIn && !checkedOut && !isOnBreak && (
                <>
                  {!record?.break_start && (
                    <button onClick={() => { setGpsError(null); breakOutMut.mutate(); }} disabled={busy}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 20px', borderRadius: 999, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, background: '#FEF3C7', color: '#B45309', opacity: busy ? 0.55 : 1 }}>
                      {breakOutMut.isPending ? '…' : '⏸ Take a break'}
                    </button>
                  )}
                  <button onClick={handleCheckOut} disabled={busy}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 20px', borderRadius: 999, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, background: 'var(--sidebar-active-bg, #7B1D2E)', color: '#fff', opacity: busy ? 0.65 : 1 }}>
                    {checkOutMut.isPending || gettingGps ? '⏳ Saving…' : '✓ Clock Out'}
                  </button>
                </>
              )}

              {isOnBreak && (
                <button onClick={() => { setGpsError(null); breakInMut.mutate(); }} disabled={busy}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 24px', borderRadius: 999, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, background: '#FEF3C7', color: '#B45309', opacity: busy ? 0.65 : 1 }}>
                  {breakInMut.isPending ? '…' : '▶ End break'}
                </button>
              )}

              {checkedOut && (
                <p style={{ fontSize: 13, color: '#6B6560', margin: 0 }}>
                  Great work today — {fmtHours(displayHours)} logged.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
