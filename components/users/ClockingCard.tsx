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

  const checkInMut = useMutation({
    mutationFn: (coords: { latitude: number; longitude: number }) =>
      hrSelfAttendanceApi.checkIn(coords),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today', emp?.id] });
      toast({ title: 'Checked in successfully.' });
    },
    onError: (err: any) => {
      setGpsError(err?.response?.data?.detail ?? 'Check-in failed. Please try again.');
    },
    throwOnError: false,
  });

  const checkOutMut = useMutation({
    mutationFn: (data?: { latitude?: number; longitude?: number }) =>
      hrSelfAttendanceApi.checkOut(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today', emp?.id] });
      toast({ title: 'Checked out successfully.' });
    },
    onError: (err: any) => {
      setGpsError(err?.response?.data?.detail ?? 'Check-out failed. Please try again.');
    },
    throwOnError: false,
  });

  const handleCheckIn = () => {
    setGpsError(null);
    if (checkedIn) {
      setGpsError('You have already clocked in today.');
      return;
    }
    if (!navigator.geolocation) {
      setGpsError('GPS not available. Please use a device with location services enabled.');
      return;
    }
    setGettingGps(true);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGettingGps(false);
          checkInMut.mutate({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        (err) => {
          setGettingGps(false);
          const msg =
            err.code === err.PERMISSION_DENIED
              ? 'Location access denied. Enable GPS in your browser settings and try again.'
              : err.code === err.TIMEOUT
              ? 'GPS timed out. Check your signal and try again.'
              : 'Could not get your location. Please try again.';
          setGpsError(msg);
        },
        { timeout: 10000, maximumAge: 30000 },
      );
    } catch {
      setGettingGps(false);
      setGpsError('Could not access location services. Please try again.');
    }
  };

  const handleCheckOut = () => {
    setGpsError(null);
    if (checkedOut) {
      setGpsError('Your shift is already complete for today.');
      return;
    }
    if (!checkedIn) {
      setGpsError('Please clock in before clocking out.');
      return;
    }
    if (!navigator.geolocation) {
      checkOutMut.mutate();
      return;
    }
    setGettingGps(true);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGettingGps(false);
          checkOutMut.mutate({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        () => {
          setGettingGps(false);
          checkOutMut.mutate();
        },
        { timeout: 5000, maximumAge: 60000 },
      );
    } catch {
      setGettingGps(false);
      checkOutMut.mutate();
    }
  };

  const busy      = gettingGps || checkInMut.isPending || checkOutMut.isPending;
  const checkedIn  = !!record?.check_in;
  const checkedOut = !!record?.check_out;

  return (
    <div className="card">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>
          Today&apos;s Clocking
        </h3>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{todayLabel}</span>
      </div>

      {/* No employee profile linked */}
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
            <div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-1)' }}>Check Out</p>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                {fmtTime(record?.check_out)}
              </p>
            </div>
            {checkedOut && record?.duration_hours != null && (
              <div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-1)' }}>Duration</p>
                <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>
                  {fmtHours(record.duration_hours)}
                </p>
              </div>
            )}
          </div>

          {/* Status pill + out-of-range notice */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
            {!checkedIn && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', padding: '2px 10px', borderRadius: '999px', border: '1px solid var(--border)' }}>
                Not started
              </span>
            )}
            {checkedIn && !checkedOut && (
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
              <Button
                onClick={handleCheckIn}
                disabled={busy || checkedIn}
              >
                {(gettingGps && !checkedIn) || checkInMut.isPending ? 'Locating…' : 'Clock In'}
              </Button>
              <Button
                onClick={handleCheckOut}
                disabled={busy || !checkedIn || checkedOut}
              >
                {(gettingGps && checkedIn && !checkedOut) || checkOutMut.isPending ? 'Locating…' : 'Clock Out'}
              </Button>
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
