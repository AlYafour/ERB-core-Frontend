'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, PageHeader, Loader } from '@/components/ui';
import { hrSelfAttendanceApi } from '@/lib/api/hr';
import type { AttendanceGradeRow } from '@/types';

const CARD: React.CSSProperties = {
  background: 'var(--surface-primary)', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)',
};
const INPUT: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--input-border)',
  background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)', boxSizing: 'border-box',
};
const TH: React.CSSProperties = {
  textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
  color: 'var(--text-tertiary)', padding: '8px', textTransform: 'uppercase', letterSpacing: '0.05em',
};
const TD: React.CSSProperties = { padding: '8px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', borderTop: '1px solid var(--border-subtle)' };
const NUM: React.CSSProperties = { ...TD, textAlign: 'right', fontFamily: 'monospace' };

const GRADE_STYLE: Record<string, React.CSSProperties> = {
  A: { background: 'var(--status-success-bg)', color: 'var(--status-success)' },
  B: { background: 'var(--status-warning-bg)', color: 'var(--status-warning)' },
  C: { background: 'var(--status-error-bg)', color: 'var(--status-error)' },
};

function GradePill({ g }: { g: 'A' | 'B' | 'C' }) {
  return <span style={{ ...GRADE_STYLE[g], fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 12px', borderRadius: 999 }}>{g}</span>;
}

function monthStart(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }
function todayStr(): string { return new Date().toISOString().slice(0, 10); }

export default function AttendanceGradesPage() {
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(todayStr());

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-grades', start, end],
    queryFn: () => hrSelfAttendanceApi.gradeReport(start, end),
  });

  const summary = data?.summary ?? { A: 0, B: 0, C: 0 };
  const rows = (data?.rows ?? []) as AttendanceGradeRow[];

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="A/B/C Attendance"
          description="Each employee graded by their number of issues (late / absent / missing check-out / out-of-range) over the range. Thresholds are set on the Attendance Rules page."
          breadcrumbs={[{ label: 'HR' }, { label: 'Attendance', href: '/hr/attendance' }, { label: 'A/B/C' }]}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Date range + summary */}
          <div style={{ ...CARD, display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="date" style={INPUT} value={start} onChange={e => setStart(e.target.value)} />
              <span style={{ color: 'var(--text-tertiary)' }}>→</span>
              <input type="date" style={INPUT} value={end} onChange={e => setEnd(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              {(['A', 'B', 'C'] as const).map(g => (
                <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <GradePill g={g} />
                  <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{summary[g]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={CARD}>
            {isLoading ? <Loader /> : rows.length === 0 ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>No data for this range.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={TH}>Employee</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Late</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Absent</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Missing</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Out-of-range</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Total</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Score</th>
                    <th style={{ ...TH, textAlign: 'center' }}>Grade</th>
                  </tr></thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.employee}>
                        <td style={TD}>{r.employee_name}<br /><span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{r.employee_id_code}</span></td>
                        <td style={NUM}>{r.late}</td>
                        <td style={NUM}>{r.absent}</td>
                        <td style={NUM}>{r.missing}</td>
                        <td style={NUM}>{r.out_of_range}</td>
                        <td style={{ ...NUM, fontWeight: 700 }}>{r.total}</td>
                        <td style={{ ...NUM, fontWeight: 700 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: { green: '#16a34a', yellow: '#CA8A04', orange: '#EA580C', red: '#DC2626' }[r.zone] }} />
                            {r.score}
                          </span>
                        </td>
                        <td style={{ ...TD, textAlign: 'center' }}><GradePill g={r.grade} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
}
