'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TimeEntry } from '@/types';
import { timeEntriesApi } from '@/lib/api/tasks';
import { useAuth } from '@/lib/hooks/use-auth';
import { toast } from '@/lib/hooks/use-toast';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtHours(h: string | number) {
  const n = Number(h);
  if (n === 1) return '1h';
  if (n < 1) return `${Math.round(n * 60)}m`;
  return `${n}h`;
}

interface Props { taskId: number }

export function TimeTab({ taskId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [hours, setHours]       = useState('');
  const [desc, setDesc]         = useState('');
  const [date, setDate]         = useState(today());

  const { data: entries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: ['time-entries', taskId],
    queryFn: () => timeEntriesApi.list(taskId),
  });

  const total = entries.reduce((s, e) => s + Number(e.hours), 0);

  const addMutation = useMutation({
    mutationFn: () => timeEntriesApi.create({
      task: taskId,
      hours: Number(hours),
      description: desc,
      date,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries', taskId] });
      setHours(''); setDesc('');
      toast('Time logged', 'success');
    },
    onError: () => toast('Failed to log time', 'error'),
  });

  const delMutation = useMutation({
    mutationFn: (id: number) => timeEntriesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-entries', taskId] }),
    onError: () => toast('Failed to delete entry', 'error'),
  });

  return (
    <div>
      {/* Log time form */}
      <div style={{ background: 'var(--surface-subtle)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Log Time
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px', gap: 8, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Hours</label>
            <input
              type="number" min="0.25" max="24" step="0.25"
              value={hours}
              onChange={e => setHours(e.target.value)}
              placeholder="e.g. 2"
              className="task-input"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Description</label>
            <input
              type="text"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="What did you work on?"
              className="task-input"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="task-input"
              style={{ width: '100%' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button
            onClick={() => { if (hours && Number(hours) > 0) addMutation.mutate(); }}
            disabled={!hours || Number(hours) <= 0 || addMutation.isPending}
            className="task-btn task-btn--primary"
            style={{ opacity: hours && Number(hours) > 0 ? 1 : 0.5 }}
          >
            {addMutation.isPending ? 'Logging…' : 'Log Time'}
          </button>
        </div>
      </div>

      {/* Summary */}
      {entries.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Total logged:</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)' }}>{fmtHours(total)}</span>
        </div>
      )}

      {/* Entries list */}
      {isLoading ? (
        <div style={{ height: 60, background: 'var(--surface-subtle)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
      ) : entries.length === 0 ? (
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', padding: '20px 0', margin: 0 }}>
          No time logged yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map(e => (
            <div key={e.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 12px', background: 'var(--card-bg)',
              border: '1px solid var(--border-subtle)', borderRadius: 8,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 8, background: 'var(--brand-10)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--brand)' }}>{fmtHours(e.hours)}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px' }}>
                  {e.description || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No description</span>}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>
                  {e.logged_by_detail.full_name} · {e.date}
                </p>
              </div>
              {(user as any)?.id === e.logged_by && (
                <button
                  onClick={() => delMutation.mutate(e.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
                  aria-label="Delete"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
