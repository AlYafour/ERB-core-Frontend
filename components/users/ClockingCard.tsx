'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrSelfAttendanceApi } from '@/lib/api/hr';
import { Button, Loader } from '@/components/ui';
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
  const hrs = Math.floor(h);
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

export default function ClockingCard({ emp, isSelf }: Props) {
  const queryClient = useQueryClient();
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gettingGps, setGettingGps] = useState(false);

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const { data: record, isLoading } = useQuery({
    queryKey: ['attendance-today', emp?.id],
    queryFn: () => hrSelfAttendanceApi.getToday(emp!.id),
    enabled: !!emp,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['attendance-today', emp?.id] });

  const checkInMut = useMutation({
    mutationFn: (coords: { latitude: number; longitude: number }) => hrSelfAttendanceApi.checkIn(coords),
    onSuccess: () => { invalidate(); toast('Checked in successfully.', 'success'); },
    onError: (err: any) => setGpsError(err?.response?.data?.detail ?? 'Check-in failed.'),
    throwOnError: false,
  });

  const checkOutMut = useMutation({
    mutationFn: (data?: { latitude?: number; longitude?: number }) => hrSelfAttendanceApi.checkOut(data),
    onSuccess: () => { invalidate(); toast('Checked out successfully.', 'success'); },
    onError: (err: any) => setGpsError(err?.response?.data?.detail ?? 'Check-out failed.'),
    throwOnError: false,
  });

  const breakOutMut = useMutation({
    mutationFn: () => hrSelfAttendanceApi.breakOut(),
    onSuccess: () => { invalidate(); toast('Break started.', 'success'); },
    onError: (err: any) => setGpsError(err?.response?.data?.detail ?? 'Failed to start break.'),
    throwOnError: false,
  });

  const breakInMut = useMutation({
    mutationFn: () => hrSelfAttendanceApi.breakIn(),
    onSuccess: () => { invalidate(); toast('Break ended — welcome back.', 'success'); },
    onError: (err: any) => setGpsError(err?.response?.data?.detail ?? 'Failed to end break.'),
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

  return (
    <div className="card">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>
          Today&apos;s Clocking
        </h3>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{todayLabel}</span>
      </div>

      {!emp && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          No employee profile is linked to your account.
        </p>
      )}

      {emp && isLoading && <Loader />}

      {emp && !isLoading && (
        <>
          {/* Time grid */}
          <div style={{ display: 'flex', gap: 'var(--space-8)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-1)' }}>Check In</p>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                {fmtTime(record?.check_in)}
              </p>
            </div>
            {record?.break_start && (
              <div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-1)' }}>Break</p>
                <p style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', margin: 0, fontVariantNumeric: 'tabular-nums', color: '#b45309' }}>
                  {fmtTime(record.break_start)}{record.break_end ? `–${fmtTime(record.break_end)}` : '…'}
                </p>
              </div>
            )}
            <div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-1)' }}>Check Out</p>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                {fmtTime(record?.check_out)}
              </p>
            </div>
            {checkedOut && record?.work_hours != null && (
              <div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-1)' }}>Hours</p>
                <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>
                  {fmtHours(record.work_hours)}
                </p>
              </div>
            )}
          </div>

          {/* Status pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
            {!checkedIn && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', padding: '2px 10px', borderRadius: '999px', border: '1px solid var(--border)' }}>
                Not started
              </span>
            )}
            {checkedIn && isOnBreak && (
              <span style={{ fontSize: 'var(--text-xs)', color: '#b45309', padding: '2px 10px', borderRadius: '999px', border: '1px solid #b45309' }}>
                On break · since {fmtTime(record?.break_start)}
              </span>
            )}
            {checkedIn && !isOnBreak && !checkedOut && (
              <span style={{ fontSize: 'var(--text-xs)', color: '#b45309', padding: '2px 10px', borderRadius: '999px', border: '1px solid #b45309' }}>
                In progress
              </span>
            )}
            {checkedOut && (
              <span style={{ fontSize: 'var(--text-xs)', color: '#16a34a', padding: '2px 10px', borderRadius: '999px', border: '1px solid #16a34a' }}>
                Complete
              </span>
            )}
            {record?.is_out_of_range && (
              <span style={{ fontSize: 'var(--text-xs)', color: '#b45309' }}>
                Checked in outside assigned location
              </span>
            )}
          </div>

          {/* GPS / API error */}
          {gpsError && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-error)', margin: '0 0 var(--space-4)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-error)', backgroundColor: 'color-mix(in srgb, var(--color-error) 8%, transparent)' }}>
              {gpsError}
            </p>
          )}

          {/* Action buttons — shown only when viewing own profile */}
          {isSelf && (
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
              {!checkedIn && (
                <Button onClick={handleCheckIn} disabled={busy}>
                  {gettingGps || checkInMut.isPending ? 'Locating…' : 'Clock In'}
                </Button>
              )}

              {checkedIn && !checkedOut && !isOnBreak && (
                <>
                  <Button onClick={handleCheckOut} disabled={busy}>
                    {checkOutMut.isPending ? 'Saving…' : 'Clock Out'}
                  </Button>
                  {!record?.break_start && (
                    <Button variant="secondary" onClick={() => { setGpsError(null); breakOutMut.mutate(); }} disabled={busy}>
                      {breakOutMut.isPending ? 'Saving…' : 'Start Break'}
                    </Button>
                  )}
                </>
              )}

              {isOnBreak && (
                <Button onClick={() => { setGpsError(null); breakInMut.mutate(); }} disabled={busy}>
                  {breakInMut.isPending ? 'Saving…' : 'End Break'}
                </Button>
              )}

              {checkedOut && (
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  Shift complete for today.
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
