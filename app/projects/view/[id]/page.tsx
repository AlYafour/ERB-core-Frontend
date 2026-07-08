'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/projects';
import {
  projectMembersApi,
  projectCostsApi,
  costCategoriesApi,
  type ProjectCost,
} from '@/lib/api/project-costs';
import { hrEmployeesApi } from '@/lib/api/hr';
import { HREmployee } from '@/types';
import { Badge, Button, Drawer, PageShell } from '@/components/ui';
import { PROJECT_STATUS } from '@/lib/utils/status-colors';
import { PROJECT_LABEL } from '@/lib/constants/status-labels';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import EntityHeader from '@/components/ui/EntityHeader';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(dt: string) {
  return new Date(dt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function fmtDate(dt: string) {
  return new Date(dt).toLocaleDateString('en-GB');
}

const fmtAED = (amount: string | number) =>
  new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', minimumFractionDigits: 2 }).format(Number(amount) || 0);

function Field({ label, value, mono, full }: { label: string; value?: string | null; mono?: boolean; full?: boolean }) {
  return (
    <div className={full ? 'info-full' : undefined}>
      <div className="info-label">{label}</div>
      <div className={mono ? 'info-value-mono' : 'info-value'}>{value || '—'}</div>
    </div>
  );
}

// Source module color mapping
const SOURCE_COLORS: Record<string, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  labor:           'success',
  procurement:     'info',
  subcontractors:  'warning',
  expenses:        'error',
  manual:          'default',
};

// ── Tab definitions ────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Members', 'Costs'] as const;
type TabKey = typeof TABS[number];

const TAB_ICONS: Record<TabKey, React.ReactNode> = {
  Overview: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  Members: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
  Costs: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  ),
};

// ── Summary card ───────────────────────────────────────────────────────────────

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: 'brand' | 'success' | 'warning' }) {
  const color = accent === 'brand' ? 'var(--brand)' : accent === 'success' ? 'var(--color-success-600, #16a34a)' : accent === 'warning' ? 'var(--color-warning-600, #d97706)' : 'var(--text-primary)';
  return (
    <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  );
}

// ── Members Tab ────────────────────────────────────────────────────────────────

function MembersTab({ projectId, isAdmin }: { projectId: number; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState({ employee: '' as string, role: '', is_primary: false });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => projectMembersApi.getProjectMembers(projectId),
    staleTime: 60_000,
  });

  const { data: employeesData } = useQuery({
    queryKey: ['hr-employees-minimal'],
    queryFn: () => hrEmployeesApi.getAll({ page_size: 500, is_active: true }),
    staleTime: 120_000,
  });
  const employees: HREmployee[] = employeesData?.results ?? [];

  // Exclude already-added employees
  const memberEmpIds = new Set(members.map(m => m.employee));
  const availableEmployees = employees.filter(e => !memberEmpIds.has(e.id));

  const addMut = useMutation({
    mutationFn: () => projectMembersApi.addProjectMember(projectId, {
      employee: Number(form.employee),
      role: form.role || 'Member',
      is_primary: form.is_primary,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-members', projectId] });
      setDrawerOpen(false);
      setForm({ employee: '', role: '', is_primary: false });
      toast('Member added', 'success');
    },
    onError: (e: unknown) => toast(getApiError(e, 'Failed to add member'), 'error'),
  });

  const removeMut = useMutation({
    mutationFn: (memberId: number) => projectMembersApi.removeProjectMember(projectId, memberId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-members', projectId] }); toast('Member removed', 'success'); },
    onError: () => toast('Failed to remove member', 'error'),
  });

  const handleRemove = async (memberId: number, name: string) => {
    if (await confirm(`Remove ${name} from this project?`)) removeMut.mutate(memberId);
  };

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Project Members
            <span style={{ marginLeft: 8, fontSize: 'var(--text-sm)', fontWeight: 400, color: 'var(--text-tertiary)' }}>
              ({members.length})
            </span>
          </h3>
          {isAdmin && (
            <Button variant="primary" onClick={() => setDrawerOpen(true)}>
              + Add Member
            </Button>
          )}
        </div>

        {isLoading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
            Loading members...
          </div>
        ) : members.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
            No members assigned to this project yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Employee', 'Role', 'Status', 'Primary', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {m.employee_name || `Employee #${m.employee}`}
                      {m.employee_id_code && (
                        <span style={{ marginLeft: 6, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                          {m.employee_id_code}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{m.role || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge variant={m.status === 'active' ? 'success' : 'error'}>
                        {m.status_display || m.status}
                      </Badge>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {m.is_primary ? (
                        <Badge variant="info">Primary</Badge>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {isAdmin && (
                        <button
                          onClick={() => handleRemove(m.id, m.employee_name || 'this member')}
                          disabled={removeMut.isPending}
                          style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error-600, #dc2626)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontWeight: 500 }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-error-50, #fef2f2)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Member Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => { setDrawerOpen(false); setForm({ employee: '', role: '', is_primary: false }); }}
        title="Add Project Member"
        description="Assign an employee to this project"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!form.employee || addMut.isPending}
              isLoading={addMut.isPending}
              onClick={() => addMut.mutate()}
            >
              Add Member
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="form-field">
            <label className="form-label">Employee *</label>
            <SearchableDropdown
              options={[
                { value: '', label: '— Select Employee —' },
                ...availableEmployees.map(e => ({
                  value: String(e.id),
                  label: e.full_name,
                  sublabel: e.position_title || '',
                })),
              ]}
              value={form.employee}
              onChange={(v) => setForm(f => ({ ...f, employee: v ? String(v) : '' }))}
              placeholder="Search employee..."
            />
          </div>

          <div className="form-field">
            <label className="form-label">Role</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Site Engineer, Supervisor"
              value={form.role}
              onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <input
              type="checkbox"
              id="is_primary_member"
              checked={form.is_primary}
              onChange={(e) => setForm(f => ({ ...f, is_primary: e.target.checked }))}
              style={{ width: 16, height: 16 }}
            />
            <label htmlFor="is_primary_member" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', cursor: 'pointer' }}>
              Primary member
            </label>
          </div>
        </div>
      </Drawer>
    </>
  );
}

// ── Costs Tab ──────────────────────────────────────────────────────────────────

function CostsTab({ projectId, isAdmin = false }: { projectId: number; isAdmin?: boolean }) {
  const qc = useQueryClient();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [groupBySource, setGroupBySource] = useState(false);
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [costForm, setCostForm] = useState({ cost_date: '', amount: '', cost_category: '' as string, description: '' });

  const summaryParams = useMemo(() => ({
    ...(dateFrom ? { start_date: dateFrom } : {}),
    ...(dateTo   ? { end_date:   dateTo   } : {}),
  }), [dateFrom, dateTo]);

  const costParams = useMemo(() => ({
    ...(dateFrom      ? { start_date: dateFrom }      : {}),
    ...(dateTo        ? { end_date:   dateTo   }       : {}),
    ...(categoryFilter ? { category: Number(categoryFilter) } : {}),
    page_size: 500,
  }), [dateFrom, dateTo, categoryFilter]);

  const { data: summary } = useQuery({
    queryKey: ['project-cost-summary', projectId, summaryParams],
    queryFn: () => projectCostsApi.getProjectCostSummary(projectId, summaryParams),
    staleTime: 60_000,
  });

  const { data: costsPage, isLoading: costsLoading } = useQuery({
    queryKey: ['project-costs', projectId, costParams],
    queryFn: () => projectCostsApi.getProjectCosts(projectId, costParams),
    staleTime: 60_000,
  });
  const costs: ProjectCost[] = costsPage?.results ?? [];

  const { data: categories = [] } = useQuery({
    queryKey: ['cost-categories'],
    queryFn: () => costCategoriesApi.getCostCategories({ is_active: true }),
    staleTime: 300_000,
  });

  const createMut = useMutation({
    mutationFn: () => projectCostsApi.createProjectCost(projectId, {
      cost_date: costForm.cost_date,
      amount: costForm.amount,
      cost_category: costForm.cost_category ? Number(costForm.cost_category) : null,
      description: costForm.description,
      source_module: 'manual',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-costs', projectId] });
      qc.invalidateQueries({ queryKey: ['project-cost-summary', projectId] });
      setAddDrawerOpen(false);
      setCostForm({ cost_date: '', amount: '', cost_category: '', description: '' });
      toast('Cost entry added', 'success');
    },
    onError: (e: unknown) => toast(getApiError(e, 'Failed to add cost'), 'error'),
  });

  // Group costs by source_module when toggle is on
  const displayedRows = useMemo(() => {
    if (!groupBySource) return costs;
    return [...costs].sort((a, b) => a.source_module.localeCompare(b.source_module));
  }, [costs, groupBySource]);

  const totalAmount = summary?.total_amount ?? 0;
  const laborTotal  = summary?.by_source_module?.find(s => s.source_module === 'labor')?.total  ?? 0;
  const otherTotal  = totalAmount - laborTotal;

  return (
    <>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        <SummaryCard label="Total Cost"   value={fmtAED(totalAmount)} accent="brand"    />
        <SummaryCard label="Labor Cost"   value={fmtAED(laborTotal)}  accent="success"  />
        <SummaryCard label="Other Costs"  value={fmtAED(otherTotal)}  accent="warning"  />
      </div>

      {/* Filters + Actions row */}
      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div className="form-field" style={{ flex: '1 1 160px' }}>
            <label className="form-label">From Date</label>
            <input type="date" className="form-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: '1 1 160px' }}>
            <label className="form-label">To Date</label>
            <input type="date" className="form-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: '1 1 200px' }}>
            <label className="form-label">Category</label>
            <select className="form-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', paddingBottom: 'var(--space-1)' }}>
            <input
              type="checkbox"
              id="group_by_source"
              checked={groupBySource}
              onChange={(e) => setGroupBySource(e.target.checked)}
              style={{ width: 14, height: 14 }}
            />
            <label htmlFor="group_by_source" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Group by source
            </label>
          </div>
          {isAdmin && <Button variant="primary" onClick={() => setAddDrawerOpen(true)}>+ Manual Cost</Button>}
        </div>

        {/* Costs Table */}
        {costsLoading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
            Loading costs...
          </div>
        ) : costs.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
            No cost records found for the selected filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Date', 'Description', 'Category', 'Source', 'Amount (AED)'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Amount (AED)' ? 'right' : 'left', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupBySource && (() => {
                  const groups: Record<string, ProjectCost[]> = {};
                  displayedRows.forEach(r => { (groups[r.source_module] ??= []).push(r); });
                  return Object.entries(groups).map(([src, rows]) => (
                    <>
                      <tr key={`hdr-${src}`} style={{ background: 'var(--surface-subtle)' }}>
                        <td colSpan={5} style={{ padding: '6px 12px', fontWeight: 600, fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                          {rows[0]?.source_module_display || src}
                          <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                            {fmtAED(rows.reduce((s, r) => s + Number(r.amount), 0))}
                          </span>
                        </td>
                      </tr>
                      {rows.map(r => <CostRow key={r.id} cost={r} />)}
                    </>
                  ));
                })()}
                {!groupBySource && displayedRows.map(r => <CostRow key={r.id} cost={r} />)}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border-subtle)' }}>
                  <td colSpan={4} style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                    Total
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                    {fmtAED(costs.reduce((s, r) => s + Number(r.amount), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Add Manual Cost Drawer */}
      <Drawer
        isOpen={addDrawerOpen}
        onClose={() => { setAddDrawerOpen(false); setCostForm({ cost_date: '', amount: '', cost_category: '', description: '' }); }}
        title="Add Manual Cost"
        description="Record a cost entry manually for this project"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddDrawerOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!costForm.cost_date || !costForm.amount || createMut.isPending}
              isLoading={createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              Save Cost
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="form-field">
            <label className="form-label">Date *</label>
            <input
              type="date"
              className="form-input"
              value={costForm.cost_date}
              onChange={(e) => setCostForm(f => ({ ...f, cost_date: e.target.value }))}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Amount (AED) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-input"
              placeholder="0.00"
              value={costForm.amount}
              onChange={(e) => setCostForm(f => ({ ...f, amount: e.target.value }))}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={costForm.cost_category}
              onChange={(e) => setCostForm(f => ({ ...f, cost_category: e.target.value }))}
            >
              <option value="">— None —</option>
              {categories.map(c => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Optional description..."
              value={costForm.description}
              onChange={(e) => setCostForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            Labor costs from approved Work Logs are recorded automatically and are read-only.
          </p>
        </div>
      </Drawer>
    </>
  );
}

function CostRow({ cost }: { cost: ProjectCost }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {fmtDate(cost.cost_date)}
      </td>
      <td style={{ padding: '10px 12px', color: 'var(--text-primary)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {cost.description || '—'}
      </td>
      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
        {cost.cost_category_name || '—'}
      </td>
      <td style={{ padding: '10px 12px' }}>
        <Badge variant={SOURCE_COLORS[cost.source_module] ?? 'default'}>
          {cost.source_module_display || cost.source_module}
        </Badge>
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {fmtAED(cost.amount)}
      </td>
    </tr>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;

  const [activeTab, setActiveTab] = useState<TabKey>('Overview');

  const { data: project, isLoading } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => projectsApi.getById(id),
  });

  if (isLoading) {
    return (
      <MainLayout>
        <PageShell>
          <div className="card animate-pulse" style={{ height: 120 }} />
          <div className="card animate-pulse" style={{ height: 280 }} />
        </PageShell>
      </MainLayout>
    );
  }

  if (!project) {
    return (
      <MainLayout>
        <PageShell>
          <div className="card empty-state">
            <p className="empty-state-title">Project not found</p>
          </div>
        </PageShell>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageShell>
        <EntityHeader
          title={project.name}
          subtitle={project.code}
          image={project.image_url || project.image}
          imageAlt={project.name}
          entityType="project"
          statusBadge={PROJECT_LABEL[project.project_status] || project.project_status}
          statusVariant={(PROJECT_STATUS[project.project_status] ?? 'info') as 'success' | 'error' | 'warning' | 'info'}
          backHref="/projects"
          backLabel="Back to Projects"
          actions={
            isAdmin ? (
              <Link href={`/projects/${id}`} className="btn btn-edit">Edit</Link>
            ) : undefined
          }
        />

        {/* Tab bar — pill style matching employee detail */}
        <div style={{ display: 'flex', gap: 2, padding: 4, background: 'var(--surface-subtle)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-5)', overflowX: 'auto' }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 'calc(var(--radius-lg) - 2px)',
                border: 'none', cursor: 'pointer', fontSize: 13,
                fontWeight: activeTab === tab ? 600 : 500,
                background: activeTab === tab ? 'var(--surface-card)' : 'transparent',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)',
                boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.07), 0 0 0 1px var(--border-subtle)' : 'none',
                transition: 'background 0.12s, color 0.12s, box-shadow 0.12s',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              <span style={{ opacity: activeTab === tab ? 1 : 0.6 }}>{TAB_ICONS[tab]}</span>
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'Members' && <MembersTab projectId={id} isAdmin={isAdmin} />}
        {activeTab === 'Costs'   && <CostsTab   projectId={id} isAdmin={isAdmin} />}

        {activeTab === 'Overview' && (
          <div className="card">
            {/* Project Identity */}
            <div className="info-section-title">Project Details</div>
            <div className="info-grid">
              <Field label="Project Name" value={project.name} />
              <Field label="Project Code" value={project.code} mono />
              <Field label="Location"     value={project.location} />
              <Field label="Sector"       value={project.sector} />
              <Field label="Plot"         value={project.plot} />
              <Field label="Consultant"   value={project.consultant} />
            </div>

            {/* Contact */}
            <div className="info-section">
              <div className="info-section-title">Contact & Management</div>
              <div className="info-grid">
                <Field label="Contact Person" value={project.contact_person} />
                <Field label="Mobile"         value={project.mobile_number} />
                {project.primary_manager_name && (
                  <Field label="Primary Manager"  value={project.primary_manager_name} />
                )}
                {project.primary_manager_position && (
                  <Field label="Manager Position" value={project.primary_manager_position} />
                )}
                {project.responsible_engineer_name && (
                  <Field label="Responsible Engineer" value={project.responsible_engineer_name} />
                )}
              </div>
            </div>

            {/* Status & Timeline */}
            <div className="info-section">
              <div className="info-section-title">Status & Timeline</div>
              <div className="info-grid">
                <div>
                  <div className="info-label">Project Status</div>
                  <Badge variant={PROJECT_STATUS[project.project_status] ?? 'info'}>
                    {PROJECT_LABEL[project.project_status] || project.project_status}
                  </Badge>
                </div>
                <div>
                  <div className="info-label">Active</div>
                  <Badge variant={project.is_active ? 'success' : 'error'}>
                    {project.is_active ? 'Yes' : 'No'}
                  </Badge>
                </div>
                {project.created_at && <Field label="Created"      value={fmt(project.created_at)} />}
                {project.updated_at && <Field label="Last Updated" value={fmt(project.updated_at)} />}
              </div>
            </div>

            {/* Description */}
            {project.description && (
              <div className="info-section">
                <div className="info-section-title">Description</div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
                  {project.description}
                </p>
              </div>
            )}
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
}
