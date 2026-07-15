'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell } from '@/components/ui/PageShell';
import { Button, Badge } from '@/components/ui';
import { BaseModal } from '@/components/ui/base/BaseModal';
import { toast, confirm } from '@/lib/hooks/use-toast';
const toastOk = (m: string) => toast(m, 'success');
const toastErr = (m: string) => toast(m, 'error');
const toastInfo = (m: string) => toast(m, 'info');
import { getApiError } from '@/lib/utils/error';
import { accountingApi, type FiscalYear, type Budget, type TaxCode } from '@/lib/api/accounting';

const fmt = (v: string | number) =>
  `AED ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CARD: React.CSSProperties = {
  background: 'var(--surface-1, var(--card-bg))',
  border: '1px solid var(--border-primary, var(--border-subtle))',
  borderRadius: 'var(--radius-lg)', padding: 16,
};
const INPUT: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
  color: 'var(--text-primary)', fontSize: 'var(--text-sm)',
};
const LABEL: React.CSSProperties = {
  fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'block', marginBottom: 4,
};
const TD: React.CSSProperties = {
  padding: '6px 8px', fontSize: 'var(--text-sm)',
  borderBottom: '1px solid var(--border-primary, var(--border-subtle))',
};
const TH: React.CSSProperties = {
  ...TD, textAlign: 'left', color: 'var(--text-secondary)',
  fontSize: 'var(--text-xs)', textTransform: 'uppercase',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const EVENT_CODES = [
  'supplier_bill', 'supplier_payment', 'subcontractor_payment',
  'retention_release', 'expense_claim_paid', 'client_invoice_issued',
  'client_invoice_paid', 'payroll_accrual', 'payroll_payment',
  'eos_settlement_paid', 'depreciation', 'payment_in', 'payment_out',
  'opening_balance',
];

const TABS = [
  { key: 'general',  label: 'General' },
  { key: 'mappings', label: 'Account Mappings' },
  { key: 'tax',      label: 'Tax Codes' },
  { key: 'rules',    label: 'Posting Rules' },
  { key: 'fiscal',   label: 'Fiscal Years & Closing' },
  { key: 'fx',       label: 'Exchange Rates & FX' },
  { key: 'budgets',  label: 'Budgets' },
  { key: 'import',   label: 'Import' },
] as const;

export default function AccountingSettingsPage() {
  const [tab, setTab] = useState<typeof TABS[number]['key']>('general');
  return (
    <MainLayout>
      <PageShell>
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Accounting Settings</h1>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '7px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
              fontSize: 'var(--text-sm)', fontWeight: tab === t.key ? 700 : 400,
              border: `1px solid ${tab === t.key ? 'var(--accent-primary, #b8860b)' : 'var(--border-primary, var(--border-subtle))'}`,
              background: tab === t.key ? 'var(--surface-2, transparent)' : 'transparent',
              color: 'var(--text-primary)',
            }}>{t.label}</button>
          ))}
        </div>
        <div style={CARD}>
          {tab === 'general' && <GeneralPanel />}
          {tab === 'mappings' && <MappingsPanel />}
          {tab === 'tax' && <TaxPanel />}
          {tab === 'rules' && <RulesPanel />}
          {tab === 'fiscal' && <FiscalPanel />}
          {tab === 'fx' && <FxPanel />}
          {tab === 'budgets' && <BudgetsPanel />}
          {tab === 'import' && <ImportPanel />}
        </div>
      </PageShell>
    </MainLayout>
  );
}

function usePostableAccounts() {
  const { data } = useQuery({
    queryKey: ['acc-postable-accounts'],
    queryFn: () => accountingApi.listAccounts({ is_postable: true, is_active: true, page_size: 500 }),
  });
  return data?.results ?? [];
}

function GeneralPanel() {
  const queryClient = useQueryClient();
  const { data: s } = useQuery({ queryKey: ['acc-settings'], queryFn: accountingApi.getSettings });
  const save = useMutation({
    mutationFn: (payload: { enforce_sod?: boolean; fiscal_start_month?: number }) =>
      accountingApi.updateSettings(payload),
    onSuccess: () => { toastOk('Settings saved.'); queryClient.invalidateQueries({ queryKey: ['acc-settings'] }); },
    onError: (e) => toastErr(getApiError(e)),
  });
  if (!s) return <div style={{ color: 'var(--text-secondary)' }}>Loading…</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 520 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={LABEL}>Base currency</label><div>{s.base_currency}</div></div>
        <div><label style={LABEL}>Template</label><div>{s.coa_template}</div></div>
        <div><label style={LABEL}>Activated</label><div>{new Date(s.activated_at).toLocaleDateString()}</div></div>
        <div>
          <label style={LABEL}>Fiscal year starts in</label>
          <select style={{ ...INPUT, width: '100%' }} value={s.fiscal_start_month}
                  onChange={(e) => save.mutate({ fiscal_start_month: Number(e.target.value) })}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)' }}>
        <input type="checkbox" checked={s.enforce_sod}
               onChange={(e) => save.mutate({ enforce_sod: e.target.checked })} />
        Segregation of duties — the creator of a journal entry cannot post it
      </label>
    </div>
  );
}

function MappingsPanel() {
  const queryClient = useQueryClient();
  const accounts = usePostableAccounts();
  const { data } = useQuery({ queryKey: ['acc-mappings'], queryFn: accountingApi.listMappings });
  const update = useMutation({
    mutationFn: ({ id, account }: { id: number; account: number }) => accountingApi.updateMapping(id, account),
    onSuccess: () => { toastOk('Mapping updated.'); queryClient.invalidateQueries({ queryKey: ['acc-mappings'] }); },
    onError: (e) => toastErr(getApiError(e)),
  });
  return (
    <div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 10 }}>
        The engine posts through these semantic keys — re-point freely; history keeps its accounts.
        An unmapped key refuses to post (fail-closed).
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={TH}>Purpose</th><th style={TH}>Key</th><th style={TH}>Account</th></tr></thead>
          <tbody>
            {(data?.results ?? []).map((m) => (
              <tr key={m.id}>
                <td style={TD}>{m.key_label}</td>
                <td style={{ ...TD, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{m.key}</td>
                <td style={TD}>
                  <select style={{ ...INPUT, minWidth: 260 }} value={m.account}
                          onChange={(e) => update.mutate({ id: m.id, account: Number(e.target.value) })}>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TaxPanel() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['acc-tax'], queryFn: accountingApi.listTaxCodes });
  const [modal, setModal] = useState<Partial<TaxCode> | null>(null);
  const save = useMutation({
    mutationFn: (t: Partial<TaxCode>) => t.id
      ? accountingApi.updateTaxCode(t.id, t)
      : accountingApi.createTaxCode(t),
    onSuccess: () => { toastOk('Tax code saved.'); setModal(null); queryClient.invalidateQueries({ queryKey: ['acc-tax'] }); },
    onError: (e) => toastErr(getApiError(e)),
  });
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button size="sm" onClick={() => setModal({ code: '', name: '', name_ar: '', tax_type: 'vat', rate: '5.0000', is_recoverable: true, is_inclusive: false, is_active: true })}>+ New tax code</Button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Code', 'Name', 'Type', 'Rate %', 'Recoverable', 'Status', ''].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
        <tbody>
          {(data?.results ?? []).map((t) => (
            <tr key={t.id}>
              <td style={{ ...TD, fontWeight: 600 }}>{t.code}</td>
              <td style={TD}>{t.name}{t.name_ar ? <span style={{ color: 'var(--text-secondary)', marginInlineStart: 8, fontSize: 'var(--text-xs)' }}>{t.name_ar}</span> : null}</td>
              <td style={TD}>{t.tax_type}</td>
              <td style={TD}>{Number(t.rate)}</td>
              <td style={TD}>{t.is_recoverable ? 'Yes' : 'No'}</td>
              <td style={TD}><Badge variant={t.is_active ? 'success' : 'default'}>{t.is_active ? 'Active' : 'Inactive'}</Badge></td>
              <td style={TD}><Button variant="secondary" size="sm" onClick={() => setModal(t)}>Edit</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {modal ? (
        <BaseModal isOpen onClose={() => setModal(null)} title={modal.id ? `Edit ${modal.code}` : 'New tax code'}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={LABEL}>Code</label><input style={{ ...INPUT, width: '100%' }} value={modal.code ?? ''} onChange={(e) => setModal({ ...modal, code: e.target.value })} /></div>
            <div><label style={LABEL}>Rate %</label><input type="number" step="0.0001" style={{ ...INPUT, width: '100%' }} value={modal.rate ?? ''} onChange={(e) => setModal({ ...modal, rate: e.target.value })} /></div>
            <div><label style={LABEL}>Name</label><input style={{ ...INPUT, width: '100%' }} value={modal.name ?? ''} onChange={(e) => setModal({ ...modal, name: e.target.value })} /></div>
            <div><label style={LABEL}>Arabic name</label><input dir="rtl" style={{ ...INPUT, width: '100%' }} value={modal.name_ar ?? ''} onChange={(e) => setModal({ ...modal, name_ar: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 16, margin: '12px 0' }}>
            <label style={{ fontSize: 'var(--text-sm)' }}><input type="checkbox" checked={!!modal.is_recoverable} onChange={(e) => setModal({ ...modal, is_recoverable: e.target.checked })} /> Recoverable</label>
            <label style={{ fontSize: 'var(--text-sm)' }}><input type="checkbox" checked={!!modal.is_inclusive} onChange={(e) => setModal({ ...modal, is_inclusive: e.target.checked })} /> Price-inclusive</label>
            <label style={{ fontSize: 'var(--text-sm)' }}><input type="checkbox" checked={!!modal.is_active} onChange={(e) => setModal({ ...modal, is_active: e.target.checked })} /> Active</label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={() => save.mutate(modal)}>{save.isPending ? 'Saving…' : 'Save'}</Button>
          </div>
        </BaseModal>
      ) : null}
    </div>
  );
}

function RulesPanel() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['acc-rules'], queryFn: accountingApi.listPostingRules });
  const rules = data?.results ?? [];
  const save = useMutation({
    mutationFn: (payload: { id?: number; event_code: string; behavior: string }) =>
      accountingApi.savePostingRule(payload),
    onSuccess: () => { toastOk('Rule saved.'); queryClient.invalidateQueries({ queryKey: ['acc-rules'] }); },
    onError: (e) => toastErr(getApiError(e)),
  });
  return (
    <div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 10 }}>
        Decide per business event whether the ledger entry posts automatically,
        lands as a draft for review, or requires approval. No rule = the platform default.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 620 }}>
        <thead><tr><th style={TH}>Event</th><th style={TH}>Behavior</th></tr></thead>
        <tbody>
          {EVENT_CODES.map((code) => {
            const rule = rules.find((r) => r.event_code === code);
            return (
              <tr key={code}>
                <td style={{ ...TD, fontFamily: 'monospace' }}>{code}</td>
                <td style={TD}>
                  <select style={INPUT}
                          value={rule?.behavior ?? (code === 'opening_balance' ? 'draft' : 'auto_post')}
                          onChange={(e) => save.mutate({ id: rule?.id, event_code: code, behavior: e.target.value })}>
                    <option value="auto_post">Post automatically</option>
                    <option value="draft">Create as draft</option>
                    <option value="approval">Require approval</option>
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FiscalPanel() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['acc-fy'], queryFn: accountingApi.listFiscalYears });
  const years = data?.results ?? [];
  const [newYear, setNewYear] = useState(new Date().getFullYear() + 1);
  const [checklist, setChecklist] = useState<Record<number, { label: string; count: number; blocking: boolean }[]>>({});
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['acc-fy'] });

  const createYear = useMutation({
    mutationFn: () => accountingApi.createFiscalYear(newYear),
    onSuccess: () => { toastOk('Fiscal year created.'); refresh(); },
    onError: (e) => toastErr(getApiError(e)),
  });
  const closePeriod = useMutation({
    mutationFn: ({ id, hard }: { id: number; hard: boolean }) => accountingApi.closePeriod(id, hard),
    onSuccess: refresh, onError: (e) => toastErr(getApiError(e)),
  });
  const reopenPeriod = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => accountingApi.reopenPeriod(id, reason),
    onSuccess: refresh, onError: (e) => toastErr(getApiError(e)),
  });
  const closeYear = useMutation({
    mutationFn: (fyId: number) => accountingApi.closeFiscalYear(fyId),
    onSuccess: (r: { net_income?: string; journal_number?: string }) => {
      toastOk(`Year closed — net income ${fmt(r.net_income ?? 0)} rolled to retained earnings (${r.journal_number ?? 'no entry needed'}).`);
      refresh();
    },
    onError: (e) => toastErr(getApiError(e)),
  });

  const loadChecklist = async (fy: FiscalYear) => {
    try {
      const res = await accountingApi.closingChecklist(fy.id) as { checklist: { label: string; count: number; blocking: boolean }[] };
      setChecklist((prev) => ({ ...prev, [fy.id]: res.checklist }));
    } catch (e) { toastErr(getApiError(e)); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
        <div>
          <label style={LABEL}>Create fiscal year</label>
          <input type="number" style={INPUT} value={newYear} onChange={(e) => setNewYear(Number(e.target.value))} />
        </div>
        <Button variant="secondary" onClick={() => createYear.mutate()}>+ Create</Button>
      </div>

      {years.map((fy) => (
        <div key={fy.id} style={{ border: '1px solid var(--border-primary, var(--border-subtle))', borderRadius: 'var(--radius-md)', padding: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>{fy.code}</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{fy.start_date} → {fy.end_date}</span>
            <Badge variant={fy.status === 'open' ? 'success' : 'default'}>{fy.status}</Badge>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['P', 'From', 'To', 'Status', ''].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {fy.periods.map((p) => (
                  <tr key={p.id}>
                    <td style={TD}>{p.number}</td>
                    <td style={TD}>{p.start_date}</td>
                    <td style={TD}>{p.end_date}</td>
                    <td style={TD}><Badge variant={p.status === 'open' ? 'success' : p.status === 'locked' ? 'error' : 'warning'}>{p.status}</Badge></td>
                    <td style={TD}>
                      {p.status === 'open' ? (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <Button variant="secondary" size="sm" onClick={() => closePeriod.mutate({ id: p.id, hard: false })}>Soft close</Button>
                          <Button variant="secondary" size="sm" onClick={() => closePeriod.mutate({ id: p.id, hard: true })}>Hard close</Button>
                        </span>
                      ) : p.status !== 'locked' ? (
                        <Button variant="secondary" size="sm" onClick={async () => {
                          if (await confirm(`Reopen period ${p.number}?`)) reopenPeriod.mutate({ id: p.id, reason: 'Reopened from settings' });
                        }}>Reopen</Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {fy.status === 'open' ? (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" size="sm" onClick={() => loadChecklist(fy)}>Load closing checklist</Button>
                <Button size="sm" onClick={async () => {
                  if (await confirm(`Close ${fy.code}? Profit & loss rolls into retained earnings and ALL periods lock permanently.`)) {
                    closeYear.mutate(fy.id);
                  }
                }}>Close year</Button>
              </div>
              {checklist[fy.id]?.map((item) => (
                <div key={item.label} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 'var(--text-sm)' }}>
                  <Badge variant={item.count === 0 ? 'success' : item.blocking ? 'error' : 'warning'}>
                    {item.count}
                  </Badge>
                  <span>{item.label}</span>
                  {item.blocking ? <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>(blocking)</span> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function FxPanel() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['acc-fx'], queryFn: () => accountingApi.listExchangeRates({ page_size: 100 }) });
  const rates: { id: number; currency: string; rate_date: string; rate: string }[] =
    (data as { results?: { id: number; currency: string; rate_date: string; rate: string }[] })?.results ?? [];
  const [f, setF] = useState({ currency: 'USD', rate_date: new Date().toISOString().slice(0, 10), rate: '' });
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));

  const add = useMutation({
    mutationFn: () => accountingApi.createExchangeRate(f),
    onSuccess: () => { toastOk('Rate saved.'); queryClient.invalidateQueries({ queryKey: ['acc-fx'] }); },
    onError: (e) => toastErr(getApiError(e)),
  });
  const revalue = useMutation({
    mutationFn: () => accountingApi.revalueFx(asOf),
    onSuccess: (r: { revalued?: number; journal_number?: string | null }) =>
      toastOk(r.revalued
        ? `Revalued ${r.revalued} account(s) — journal ${r.journal_number}.`
        : 'Nothing to revalue at current rates.'),
    onError: (e) => toastErr(getApiError(e)),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 620 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <div><label style={LABEL}>Currency</label><input style={{ ...INPUT, width: 90 }} maxLength={3} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></div>
        <div><label style={LABEL}>Date</label><input type="date" style={INPUT} value={f.rate_date} onChange={(e) => setF({ ...f, rate_date: e.target.value })} /></div>
        <div><label style={LABEL}>Rate (1 unit = ? AED)</label><input type="number" step="0.000001" style={INPUT} value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></div>
        <Button variant="secondary" onClick={() => { if (Number(f.rate) > 0) add.mutate(); else toastErr('Enter a positive rate.'); }}>+ Add rate</Button>
      </div>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead><tr><th style={TH}>Currency</th><th style={TH}>Date</th><th style={TH}>Rate</th></tr></thead>
        <tbody>
          {rates.map((r) => (
            <tr key={r.id}><td style={TD}>{r.currency}</td><td style={TD}>{r.rate_date}</td><td style={TD}>{Number(r.rate)}</td></tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
        <div><label style={LABEL}>Revalue foreign-currency accounts as of</label>
          <input type="date" style={INPUT} value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>
        <Button onClick={() => revalue.mutate()}>Run FX revaluation</Button>
      </div>
    </div>
  );
}

function BudgetsPanel() {
  const queryClient = useQueryClient();
  const accounts = usePostableAccounts();
  const { data: fyData } = useQuery({ queryKey: ['acc-fy'], queryFn: accountingApi.listFiscalYears });
  const { data } = useQuery({ queryKey: ['acc-budgets'], queryFn: () => accountingApi.listBudgets() });
  const budgets = data?.results ?? [];
  const [modal, setModal] = useState<Partial<Budget> | null>(null);
  const [variance, setVariance] = useState<Record<string, unknown> | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['acc-budgets'] });

  const create = useMutation({
    mutationFn: (b: Partial<Budget>) => accountingApi.createBudget(b),
    onSuccess: () => { toastOk('Budget created.'); setModal(null); refresh(); },
    onError: (e) => toastErr(getApiError(e)),
  });
  const activate = useMutation({
    mutationFn: (id: string) => accountingApi.activateBudget(id),
    onSuccess: () => { toastOk('Budget activated.'); refresh(); },
    onError: (e) => toastErr(getApiError(e)),
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button size="sm" onClick={() => setModal({ name: '', alert_threshold_pct: 90, lines: [] })}>+ New budget</Button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Name', 'Fiscal year', 'Threshold', 'Status', ''].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
        <tbody>
          {budgets.map((b) => (
            <tr key={b.id}>
              <td style={TD}>{b.name}</td>
              <td style={TD}>{b.fiscal_year_code}</td>
              <td style={TD}>{b.alert_threshold_pct}%</td>
              <td style={TD}><Badge variant={b.status === 'active' ? 'success' : 'default'}>{b.status}</Badge></td>
              <td style={TD}>
                <span style={{ display: 'inline-flex', gap: 6 }}>
                  {b.status === 'draft' ? <Button variant="secondary" size="sm" onClick={() => activate.mutate(b.id)}>Activate</Button> : null}
                  <Button variant="secondary" size="sm" onClick={async () => {
                    try { setVariance(await accountingApi.budgetVariance(b.id) as Record<string, unknown>); }
                    catch (e) { toastErr(getApiError(e)); }
                  }}>Variance</Button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal ? (
        <BaseModal isOpen onClose={() => setModal(null)} title="New budget">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
              <div><label style={LABEL}>Name</label><input style={{ ...INPUT, width: '100%' }} value={modal.name ?? ''} onChange={(e) => setModal({ ...modal, name: e.target.value })} /></div>
              <div>
                <label style={LABEL}>Fiscal year</label>
                <select style={{ ...INPUT, width: '100%' }} value={modal.fiscal_year ?? ''} onChange={(e) => setModal({ ...modal, fiscal_year: Number(e.target.value) })}>
                  <option value="">Select…</option>
                  {(fyData?.results ?? []).map((fy) => <option key={fy.id} value={fy.id}>{fy.code}</option>)}
                </select>
              </div>
              <div><label style={LABEL}>Alert at %</label><input type="number" style={{ ...INPUT, width: '100%' }} value={modal.alert_threshold_pct ?? 90} onChange={(e) => setModal({ ...modal, alert_threshold_pct: Number(e.target.value) })} /></div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ ...LABEL, marginBottom: 0 }}>Lines</label>
                <Button variant="secondary" size="sm" onClick={() => setModal({ ...modal, lines: [...(modal.lines ?? []), { account: 0, period: 0, amount: '' }] })}>+ Add line</Button>
              </div>
              {(modal.lines ?? []).map((l, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 6 }}>
                  <select style={INPUT} value={l.account || ''} onChange={(e) => setModal({ ...modal, lines: (modal.lines ?? []).map((x, j) => j === i ? { ...x, account: Number(e.target.value) } : x) })}>
                    <option value="">Account…</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                  <select style={INPUT} value={l.period} onChange={(e) => setModal({ ...modal, lines: (modal.lines ?? []).map((x, j) => j === i ? { ...x, period: Number(e.target.value) } : x) })}>
                    <option value={0}>Annual</option>
                    {MONTHS.map((m, mi) => <option key={m} value={mi + 1}>{m}</option>)}
                  </select>
                  <input type="number" min="0" step="0.01" placeholder="Amount" style={INPUT} value={l.amount}
                         onChange={(e) => setModal({ ...modal, lines: (modal.lines ?? []).map((x, j) => j === i ? { ...x, amount: e.target.value } : x) })} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
              <Button onClick={() => {
                if (!modal.name || !modal.fiscal_year || !(modal.lines ?? []).length) {
                  toastErr('Name, fiscal year and at least one line are required.');
                  return;
                }
                create.mutate(modal);
              }}>Save</Button>
            </div>
          </div>
        </BaseModal>
      ) : null}

      {variance ? (
        <BaseModal isOpen onClose={() => setVariance(null)} title={`Variance — ${String(variance.name)}`}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Account', 'Period', 'Budget', 'Actual', 'Variance', 'Used %'].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {(variance.lines as Record<string, unknown>[]).map((l, i) => (
                  <tr key={i} style={l.over_threshold ? { color: 'var(--error, #dc2626)' } : undefined}>
                    <td style={TD}>{String(l.account_code)} — {String(l.account_name)}</td>
                    <td style={TD}>{Number(l.period) === 0 ? 'Annual' : MONTHS[Number(l.period) - 1]}</td>
                    <td style={TD}>{fmt(String(l.budget))}</td>
                    <td style={TD}>{fmt(String(l.actual))}</td>
                    <td style={TD}>{fmt(String(l.variance))}</td>
                    <td style={TD}>{l.consumed_pct === null ? '—' : `${l.consumed_pct}%`}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700 }}>
                  <td style={TD} colSpan={2}>Totals</td>
                  <td style={TD}>{fmt(String(variance.total_budget))}</td>
                  <td style={TD}>{fmt(String(variance.total_actual))}</td>
                  <td style={TD}>{fmt(String(variance.total_variance))}</td>
                  <td style={TD} />
                </tr>
              </tbody>
            </table>
          </div>
        </BaseModal>
      ) : null}
    </div>
  );
}

function ImportPanel() {
  const [content, setContent] = useState('');
  const [result, setResult] = useState<{ created: { code: string; name: string }[]; skipped: { name: string; reason: string }[] } | null>(null);
  const run = useMutation({
    mutationFn: () => accountingApi.importQuickBooksCoA(content),
    onSuccess: (r) => { setResult(r as never); toastOk('Import finished.'); },
    onError: (e) => toastErr(getApiError(e)),
  });
  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setContent(String(reader.result ?? ''));
    reader.readAsText(file);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 680 }}>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        Import a QuickBooks chart-of-accounts CSV export. Accounts are ADDED under the matching
        classification — existing codes and names are skipped, never overwritten.
      </p>
      <input type="file" accept=".csv" style={INPUT} onChange={(e) => onFile(e.target.files?.[0])} />
      <textarea style={{ ...INPUT, minHeight: 120, fontFamily: 'monospace' }} value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={'Account Name,Type,Number\nChase Checking,Bank,10100'} />
      <div>
        <Button disabled={!content.trim() || run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? 'Importing…' : 'Import chart of accounts'}
        </Button>
      </div>
      {result ? (
        <div style={{ fontSize: 'var(--text-sm)' }}>
          <div style={{ fontWeight: 700, margin: '6px 0' }}>Created ({result.created.length})</div>
          {result.created.map((c) => <div key={c.code}>{c.code} — {c.name}</div>)}
          <div style={{ fontWeight: 700, margin: '10px 0 6px' }}>Skipped ({result.skipped.length})</div>
          {result.skipped.map((s, i) => <div key={i} style={{ color: 'var(--text-secondary)' }}>{s.name} — {s.reason}</div>)}
        </div>
      ) : null}
    </div>
  );
}
