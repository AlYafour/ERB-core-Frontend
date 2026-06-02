'use client';

import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatPrice } from '@/lib/utils/format';
import type { ChartData, ProjectAnalytics } from '@/lib/api/dashboard';

const C = {
  blue:   'var(--color-info)',
  green:  'var(--color-success)',
  amber:  'var(--color-warning)',
  red:    'var(--color-error)',
  teal:   '#0D9488',
};
const PIE_STATUS_COLORS = [C.amber, C.green, C.red, C.teal];

const tooltipStyle = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  fontSize: 12,
};

/* ── Pie card ─────────────────────────────────────────────────────── */
export function StatusPieCard({ title, data, viewAllLabel, href }: {
  title: string;
  viewAllLabel?: string;
  href: string;
  data: { name: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
          {data.map((_, i) => <Cell key={i} fill={PIE_STATUS_COLORS[i % PIE_STATUS_COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ── Monthly volume line chart ─────────────────────────────────────── */
export function MonthlyVolumeChart({ data, label }: { data: ChartData['monthlyProcurement']; label: string }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
        <XAxis dataKey="month" stroke="var(--text-secondary)" style={{ fontSize: 11 }} />
        <YAxis stroke="var(--text-secondary)" style={{ fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="count" stroke={C.blue} strokeWidth={2} dot={false} name={label} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── Project spending bar chart ────────────────────────────────────── */
export function ProjectSpendingChart({ data, label }: { data: ChartData['projectSpending']; label: string }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
        <XAxis dataKey="project" stroke="var(--text-secondary)" style={{ fontSize: 11 }} angle={-40} textAnchor="end" interval={0} />
        <YAxis stroke="var(--text-secondary)" style={{ fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatPrice(v)} />
        <Bar dataKey="spending" fill={C.green} name={label} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
