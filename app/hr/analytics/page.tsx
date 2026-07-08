'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { hrAnalyticsApi } from '@/lib/api/hr'
import { Button } from '@/components/ui/Button'
import HasPermission from '@/components/shared/HasPermission'
import { toast } from '@/lib/hooks/use-toast'
import { UsersIcon, CalendarIcon, ClockIcon, AlertIcon, DollarIcon } from '@/components/icons'

// Inline SVG icons not in @/components/icons
const TrendingDownIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
  </svg>
)

const ChartBarIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
)

// ── Mini chart helpers (inline SVG bar charts — no external deps) ─────────────

function BarChart({ data, valueKey, labelKey, color = 'var(--brand)', height = 120 }: {
  data: Record<string, unknown>[]
  valueKey: string
  labelKey: string
  color?: string
  height?: number
}) {
  if (!data.length) return (
    <div style={{ height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', gap: 8 }}>
      <ChartBarIcon className="w-8 h-8" />
      <span style={{ fontSize: 'var(--text-xs)' }}>No data available</span>
    </div>
  )
  const values = data.map(d => Number(d[valueKey]) || 0)
  const max = Math.max(...values, 1)
  const barW = Math.max(8, Math.floor(400 / data.length) - 4)
  const totalW = data.length * (barW + 4)
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={Math.max(totalW, 300)} height={height + 24} style={{ display: 'block' }}>
        {data.map((d, i) => {
          const val = Number(d[valueKey]) || 0
          const barH = Math.max(2, (val / max) * height)
          const x = i * (barW + 4)
          return (
            <g key={i}>
              <rect x={x} y={height - barH} width={barW} height={barH} fill={color} rx={2} opacity={0.85} />
              <title>{String(d[labelKey])}: {val.toLocaleString()}</title>
              {data.length <= 12 && (
                <text x={x + barW / 2} y={height + 14} textAnchor="middle" fontSize={9} fill="var(--text-tertiary)">
                  {String(d[labelKey]).slice(0, 6)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function StatCard({ icon, label, value, sub, color = 'var(--brand)' }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 'var(--space-4)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  )
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', paddingLeft: 12, borderLeft: '3px solid var(--brand)' }}>
        <h2 style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

async function downloadExcel(report: string, params?: Record<string, unknown>) {
  try {
    const r = await hrAnalyticsApi.export(report, 'excel', params)
    const url = URL.createObjectURL(new Blob([r.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `${report}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    toast('Export failed', 'error')
  }
}

export default function AnalyticsPage() {
  const [headcountGroup, setHeadcountGroup] = useState('department')
  const currentYear = new Date().getFullYear()

  const { data: headcount } = useQuery({
    queryKey: ['analytics-headcount', headcountGroup],
    queryFn: () => hrAnalyticsApi.headcount(headcountGroup).then(r => r.data),
  })
  const { data: trend = [] } = useQuery({
    queryKey: ['analytics-trend'],
    queryFn: () => hrAnalyticsApi.headcountTrend(12).then(r => r.data),
  })
  const { data: payrollCost = [] } = useQuery({
    queryKey: ['analytics-payroll'],
    queryFn: () => hrAnalyticsApi.payrollCost(6).then(r => r.data),
  })
  const { data: attendance } = useQuery({
    queryKey: ['analytics-attendance'],
    queryFn: () => hrAnalyticsApi.attendance().then(r => r.data),
  })
  const { data: overtime } = useQuery({
    queryKey: ['analytics-overtime'],
    queryFn: () => hrAnalyticsApi.overtime().then(r => r.data),
  })
  const { data: liability } = useQuery({
    queryKey: ['analytics-liability'],
    queryFn: () => hrAnalyticsApi.leaveLiability().then(r => r.data),
  })
  const { data: turnover } = useQuery({
    queryKey: ['analytics-turnover'],
    queryFn: () => hrAnalyticsApi.turnover(currentYear).then(r => r.data),
  })

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-6)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>HR Analytics</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: '4px 0 0' }}>Live workforce metrics — cached, updated hourly</p>
        </div>
        <HasPermission permission="hr_analytics:export">
          <Button variant="ghost" size="sm" onClick={() => hrAnalyticsApi.invalidateCache().then(() => toast('Cache cleared — data will refresh', 'success'))}>
            Refresh Cache
          </Button>
        </HasPermission>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <StatCard icon={<UsersIcon className="w-5 h-5" />} label="Total Headcount" value={headcount?.total ?? '—'} color="var(--brand)" />
        <StatCard icon={<CalendarIcon className="w-5 h-5" />} label="Attendance Rate" value={attendance ? `${attendance.attendance_rate}%` : '—'} color="var(--status-success)" />
        <StatCard icon={<AlertIcon className="w-5 h-5" />} label="Absence Rate" value={attendance ? `${attendance.absence_rate}%` : '—'} color="var(--status-warning)" />
        <StatCard icon={<ClockIcon className="w-5 h-5" />} label="Overtime Hours" value={overtime ? overtime.total_overtime_hours.toLocaleString() : '—'} sub="this period" color="var(--brand)" />
        <StatCard icon={<TrendingDownIcon className="w-5 h-5" />} label="Annual Turnover" value={turnover ? `${turnover.annual_turnover_rate}%` : '—'} sub={`${currentYear}`} color="var(--status-error)" />
        <StatCard icon={<DollarIcon className="w-5 h-5" />} label="Leave Liability" value={liability ? `AED ${liability.total_liability.toLocaleString()}` : '—'} color="var(--status-warning)" />
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>

        {/* Headcount by group */}
        <Section title="Headcount" action={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select value={headcountGroup} onChange={e => setHeadcountGroup(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--card-border)', borderRadius: 4 }}>
              {['department', 'location', 'group', 'nationality', 'gender'].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <HasPermission permission="hr_analytics:export">
              <Button size="sm" variant="ghost" onClick={() => downloadExcel('headcount')}>Export</Button>
            </HasPermission>
          </div>
        }>
          <BarChart data={headcount?.rows ?? []} valueKey="count" labelKey="label" color="var(--brand)" />
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(headcount?.rows ?? []).slice(0, 8).map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', padding: '3px 0', borderBottom: '1px solid var(--card-border)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
                <strong style={{ color: 'var(--text-primary)' }}>{r.count}</strong>
              </div>
            ))}
          </div>
        </Section>

        {/* 12-month trend */}
        <Section title="Headcount Trend (12 months)">
          <BarChart data={trend} valueKey="count" labelKey="label" color="var(--brand)" />
        </Section>

        {/* Payroll cost */}
        <Section title="Monthly Payroll Cost" action={
          <HasPermission permission="hr_analytics:export">
            <Button size="sm" variant="ghost" onClick={() => downloadExcel('payroll_cost', { months: 6 })}>Export</Button>
          </HasPermission>
        }>
          <BarChart data={payrollCost} valueKey="net" labelKey="label" color="var(--status-success)" />
          <div style={{ marginTop: 8, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>{['Period', 'Employees', 'Gross', 'Net'].map(h => <th key={h} style={{ padding: '4px 8px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600 }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {payrollCost.slice(-4).map(r => (
                  <tr key={r.label} style={{ borderTop: '1px solid var(--card-border)' }}>
                    <td style={{ padding: '4px 8px' }}>{r.label}</td>
                    <td style={{ padding: '4px 8px' }}>{r.employees}</td>
                    <td style={{ padding: '4px 8px', fontVariantNumeric: 'tabular-nums' }}>{r.gross.toLocaleString()}</td>
                    <td style={{ padding: '4px 8px', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--status-success)' }}>{r.net.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Turnover */}
        <Section title={`Employee Turnover ${currentYear}`} action={
          <HasPermission permission="hr_analytics:export">
            <Button size="sm" variant="ghost" onClick={() => downloadExcel('turnover', { year: currentYear })}>Export</Button>
          </HasPermission>
        }>
          <BarChart data={turnover?.monthly ?? []} valueKey="departed" labelKey="label" color="var(--status-error)" />
          <div style={{ marginTop: 8, display: 'flex', gap: 24 }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Annual rate: <strong style={{ color: 'var(--status-error)' }}>{turnover?.annual_turnover_rate ?? 0}%</strong></div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Total departed: <strong>{turnover?.total_departed ?? 0}</strong></div>
          </div>
        </Section>

      </div>

      {/* Leave Liability Table */}
      {liability && liability.rows.length > 0 && (
        <Section title="Leave Liability by Employee" action={
          <HasPermission permission="hr_analytics:export">
            <Button size="sm" variant="ghost" onClick={() => downloadExcel('leave_liability')}>Export</Button>
          </HasPermission>
        }>
          <div style={{ overflowX: 'auto', maxHeight: 300 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--card-bg)' }}>
                <tr>{['Employee', 'Department', 'Balance Days', 'Daily Rate', 'Liability (AED)'].map(h => (
                  <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--card-border)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {liability.rows.slice(0, 20).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 ? 'var(--surface-subtle)' : 'transparent' }}>
                    <td style={{ padding: '6px 12px', fontWeight: 500 }}>{r.employee_name}</td>
                    <td style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>{r.department || '—'}</td>
                    <td style={{ padding: '6px 12px', fontVariantNumeric: 'tabular-nums' }}>{r.balance_days}</td>
                    <td style={{ padding: '6px 12px', fontVariantNumeric: 'tabular-nums' }}>{r.daily_rate.toLocaleString()}</td>
                    <td style={{ padding: '6px 12px', fontWeight: 700, color: 'var(--status-warning)', fontVariantNumeric: 'tabular-nums' }}>{r.liability.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--status-warning-bg)', borderRadius: 6, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--status-warning)' }}>
            Total Liability: AED {liability.total_liability.toLocaleString()} across {liability.employee_count} employees
          </div>
        </Section>
      )}
    </div>
  )
}
