'use client';

/**
 * Full-page journal entry form — QuickBooks-style layout requested by the GM:
 * Journal date + Journal no. on top, a wide line grid with
 * Account / Debits / Credits / Description / Name / Tax / Location / Class
 * columns, running totals, memo + attachments, Save / Save and new.
 *
 * Field mapping to our engine:
 *   Journal no. → reference (the real JE number is assigned at posting)
 *   Name       → partner (supplier / customer / employee) on the line
 *   Location   → project dimension
 *   Class      → cost code dimension
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { Button, PageShell, Badge } from '@/components/ui';
import { accountingApi } from '@/lib/api/accounting';
import { costCodesApi } from '@/lib/api/cost-codes';
import { projectsApi } from '@/lib/api/projects';
import { suppliersApi } from '@/lib/api/suppliers';
import { customersApi } from '@/lib/api/customers';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import RouteGuard from '@/components/auth/RouteGuard';

interface LineDraft {
  account: string;        // account id ('' = empty)
  debit: string;
  credit: string;
  description: string;
  partner: string;        // '' or 'supplier:12' / 'customer:5'
  tax_code: string;       // '' or tax code id
  project: string;        // '' or project id
  cost_code: string;      // '' or cost code id
}

const EMPTY: LineDraft = {
  account: '', debit: '', credit: '', description: '',
  partner: '', tax_code: '', project: '', cost_code: '',
};

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number) =>
  n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TH: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontSize: 'var(--text-xs)',
  color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em',
  borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = {
  padding: '4px 6px', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle',
};
const CELL_INPUT: React.CSSProperties = {
  width: '100%', minWidth: 90, padding: '7px 8px', fontSize: 'var(--text-sm)',
  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-primary)', color: 'var(--text-primary)',
};

export default function NewJournalEntryPage() {
  return (
    <RouteGuard requiredPermission={{ category: 'journal_entry', action: 'create' }}
                redirectTo="/accounting/journal">
      <NewJournalEntryContent />
    </RouteGuard>
  );
}

function NewJournalEntryContent() {
  const router = useRouter();

  const [journalDate, setJournalDate] = useState(today());
  const [journalNo, setJournalNo]     = useState('');
  const [memo, setMemo]               = useState('');
  const [lines, setLines]             = useState<LineDraft[]>(
    Array.from({ length: 4 }, () => ({ ...EMPTY })));
  const [files, setFiles]             = useState<File[]>([]);

  /* ── Dropdown data ── */
  const { data: accData } = useQuery({
    queryKey: ['acc-postable-accounts'],
    queryFn: () => accountingApi.listAccounts({ page_size: 500, is_postable: true, is_active: true }),
    staleTime: 5 * 60 * 1000,
  });
  const { data: taxData } = useQuery({
    queryKey: ['acc-tax-codes'], queryFn: () => accountingApi.listTaxCodes(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: ccData } = useQuery({
    queryKey: ['cost-codes-all'], queryFn: () => costCodesApi.getAll(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: projData } = useQuery({
    queryKey: ['projects-for-je'], queryFn: () => projectsApi.getAll({ page_size: 300 } as any),
    staleTime: 5 * 60 * 1000,
  });
  const { data: supData } = useQuery({
    queryKey: ['suppliers-for-je'], queryFn: () => suppliersApi.getAllActive(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: custData } = useQuery({
    queryKey: ['customers-for-je'], queryFn: () => customersApi.getAll({ page_size: 300 }),
    staleTime: 5 * 60 * 1000,
  });

  const accounts  = accData?.results ?? [];
  const taxCodes  = (taxData as any)?.results ?? [];
  const costCodes = Array.isArray(ccData) ? ccData : ((ccData as any)?.results ?? []);
  const projects  = (projData as any)?.results ?? [];
  const suppliers = supData ?? [];
  const customers = (custData as any)?.results ?? [];

  /* ── Line helpers ── */
  const setLine = (idx: number, patch: Partial<LineDraft>) =>
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLines = (n = 4) =>
    setLines(prev => [...prev, ...Array.from({ length: n }, () => ({ ...EMPTY }))]);
  const copyLine = (idx: number) =>
    setLines(prev => [...prev.slice(0, idx + 1), { ...prev[idx] }, ...prev.slice(idx + 1)]);
  const removeLine = (idx: number) =>
    setLines(prev => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  const clearAll = () => setLines(Array.from({ length: 4 }, () => ({ ...EMPTY })));

  const totals = useMemo(() => {
    const debit  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
    const credit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.005 && debit > 0 };
  }, [lines]);

  const filled = lines.filter(l => l.account && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));

  /* ── Save ── */
  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        entry_date: journalDate,
        posting_date: journalDate,
        memo, reference: journalNo,
        lines: filled.map((l, i) => {
          const [ptype, pid] = l.partner ? l.partner.split(':') : ['', ''];
          return {
            line_no: i + 1,
            account: Number(l.account),
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0,
            description: l.description,
            partner_type: ptype, partner_id: pid,
            tax_code: l.tax_code ? Number(l.tax_code) : null,
            project: l.project ? Number(l.project) : null,
            cost_code: l.cost_code ? Number(l.cost_code) : null,
          };
        }),
      };
      const entry = await accountingApi.createJournal(payload);
      for (const f of files) {
        try { await accountingApi.uploadJournalAttachment(entry.id, f); }
        catch { toast(`Attachment "${f.name}" failed to upload`, 'error'); }
      }
      return entry;
    },
  });

  const save = async (andNew: boolean) => {
    if (!filled.length) { toast('Add at least two lines with amounts', 'error'); return; }
    if (!totals.balanced) { toast(`Entry is off by ${fmt(Math.abs(totals.debit - totals.credit))} — debits must equal credits`, 'error'); return; }
    try {
      await createMutation.mutateAsync();
      toast('Journal entry saved as draft', 'success');
      if (andNew) {
        setJournalNo(''); setMemo(''); setFiles([]); clearAll();
      } else {
        router.push('/accounting/journal');
      }
    } catch (err) {
      toast(getApiError(err, 'Failed to save journal entry'), 'error');
    }
  };

  const handleCancel = async () => {
    if (filled.length && !(await confirm('Discard this journal entry?'))) return;
    router.push('/accounting/journal');
  };

  return (
    <MainLayout>
      <PageShell>
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, margin: 0 }}>New Journal Entry</h1>
          <button onClick={handleCancel} aria-label="Close" style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 22, color: 'var(--text-secondary)', lineHeight: 1,
          }}>×</button>
        </div>

        {/* ── Date + Journal no. ── */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>
              Journal date <span style={{ color: 'var(--status-error)' }}>*</span>
            </label>
            <input type="date" value={journalDate} onChange={e => setJournalDate(e.target.value)}
                   style={{ ...CELL_INPUT, width: 180 }} />
          </div>
          <div style={{ flex: 1, minWidth: 220, maxWidth: 420, marginLeft: 'auto' }}>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>
              Journal no.
            </label>
            <input type="text" value={journalNo} onChange={e => setJournalNo(e.target.value)}
                   placeholder="Reference — official number is assigned when posted"
                   style={{ ...CELL_INPUT, width: '100%' }} />
          </div>
        </div>

        {/* ── Lines grid ── */}
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1150 }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: 34 }}>#</th>
                <th style={{ ...TH, minWidth: 210 }}>Account</th>
                <th style={{ ...TH, width: 110, textAlign: 'right' }}>Debits</th>
                <th style={{ ...TH, width: 110, textAlign: 'right' }}>Credits</th>
                <th style={{ ...TH, minWidth: 160 }}>Description</th>
                <th style={{ ...TH, minWidth: 170 }}>Name</th>
                <th style={{ ...TH, width: 110 }}>Tax</th>
                <th style={{ ...TH, minWidth: 140 }}>Location</th>
                <th style={{ ...TH, minWidth: 150 }}>Class</th>
                <th style={{ ...TH, width: 64 }} />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx}>
                  <td style={{ ...TD, color: 'var(--text-tertiary)', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={TD}>
                    <select value={line.account} onChange={e => setLine(idx, { account: e.target.value })} style={CELL_INPUT}>
                      <option value="" />
                      {accounts.map((a: any) => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={TD}>
                    <input type="number" min="0" step="0.01" value={line.debit}
                           onChange={e => setLine(idx, { debit: e.target.value, credit: e.target.value ? '' : line.credit })}
                           style={{ ...CELL_INPUT, textAlign: 'right' }} />
                  </td>
                  <td style={TD}>
                    <input type="number" min="0" step="0.01" value={line.credit}
                           onChange={e => setLine(idx, { credit: e.target.value, debit: e.target.value ? '' : line.debit })}
                           style={{ ...CELL_INPUT, textAlign: 'right' }} />
                  </td>
                  <td style={TD}>
                    <input type="text" value={line.description}
                           onChange={e => setLine(idx, { description: e.target.value })} style={CELL_INPUT} />
                  </td>
                  <td style={TD}>
                    <select value={line.partner} onChange={e => setLine(idx, { partner: e.target.value })} style={CELL_INPUT}>
                      <option value="" />
                      <optgroup label="Suppliers">
                        {suppliers.map((s: any) => (
                          <option key={`s${s.id}`} value={`supplier:${s.id}`}>{s.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Customers">
                        {customers.map((c: any) => (
                          <option key={`c${c.id}`} value={`customer:${c.id}`}>{c.name || c.business_name}</option>
                        ))}
                      </optgroup>
                    </select>
                  </td>
                  <td style={TD}>
                    <select value={line.tax_code} onChange={e => setLine(idx, { tax_code: e.target.value })} style={CELL_INPUT}>
                      <option value="" />
                      {taxCodes.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.code}</option>
                      ))}
                    </select>
                  </td>
                  <td style={TD}>
                    <select value={line.project} onChange={e => setLine(idx, { project: e.target.value })} style={CELL_INPUT}>
                      <option value="" />
                      {projects.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={TD}>
                    <select value={line.cost_code} onChange={e => setLine(idx, { cost_code: e.target.value })} style={CELL_INPUT}>
                      <option value="" />
                      {costCodes.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.excel_code}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ ...TD, whiteSpace: 'nowrap', textAlign: 'center' }}>
                    <button onClick={() => copyLine(idx)} title="Duplicate line" aria-label={`Duplicate line ${idx + 1}`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 3 }}>⧉</button>
                    <button onClick={() => removeLine(idx)} title="Delete line" aria-label={`Delete line ${idx + 1}`}
                            disabled={lines.length <= 1}
                            style={{ background: 'none', border: 'none', cursor: lines.length > 1 ? 'pointer' : 'not-allowed', color: 'var(--status-error)', padding: 3 }}>🗑</button>
                  </td>
                </tr>
              ))}
              <tr>
                <td style={TD} />
                <td style={{ ...TD, textAlign: 'right', fontWeight: 700 }}>Total</td>
                <td style={{ ...TD, textAlign: 'right', fontWeight: 700 }} className="font-mono">AED {fmt(totals.debit)}</td>
                <td style={{ ...TD, textAlign: 'right', fontWeight: 700 }} className="font-mono">AED {fmt(totals.credit)}</td>
                <td colSpan={5} style={TD}>
                  {(totals.debit > 0 || totals.credit > 0) && (
                    <Badge variant={totals.balanced ? 'success' : 'warning'}>
                      {totals.balanced ? 'Balanced' : `Off by ${fmt(Math.abs(totals.debit - totals.credit))}`}
                    </Badge>
                  )}
                </td>
                <td style={TD} />
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
          <Button variant="secondary" size="sm" onClick={() => addLines(4)}>Add lines</Button>
          <Button variant="ghost" size="sm" onClick={clearAll}>Clear all lines</Button>
        </div>

        {/* ── Memo + attachments ── */}
        <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', marginTop: 'var(--space-5)' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>Memo</label>
            <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={4}
                      style={{ ...CELL_INPUT, resize: 'vertical' }} />
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>Attachments</label>
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, minHeight: 96, padding: 'var(--space-3)', cursor: 'pointer',
              border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)', fontSize: 'var(--text-sm)',
            }}>
              <span style={{ color: 'var(--brand, #b8860b)', fontWeight: 600 }}>Add attachment</span>
              <span style={{ fontSize: 'var(--text-xs)' }}>Max file size: 20 MB</span>
              <input type="file" multiple hidden
                     onChange={e => {
                       const chosen = Array.from(e.target.files ?? []);
                       const ok = chosen.filter(f => f.size <= 20 * 1024 * 1024);
                       if (ok.length < chosen.length) toast('Some files exceed 20 MB and were skipped', 'error');
                       setFiles(prev => [...prev, ...ok]);
                       e.target.value = '';
                     }} />
            </label>
            {files.length > 0 && (
              <ul style={{ listStyle: 'none', margin: 'var(--space-2) 0 0', padding: 0, fontSize: 'var(--text-sm)' }}>
                {files.map((f, i) => (
                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                            style={{ background: 'none', border: 'none', color: 'var(--status-error)', cursor: 'pointer' }}>×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--border-subtle)', gap: 'var(--space-2)', flexWrap: 'wrap',
        }}>
          <Button variant="ghost" onClick={handleCancel} disabled={createMutation.isPending}>Cancel</Button>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="secondary" onClick={() => save(false)} isLoading={createMutation.isPending}
                    disabled={!totals.balanced || !filled.length}>
              Save
            </Button>
            <Button variant="primary" onClick={() => save(true)} isLoading={createMutation.isPending}
                    disabled={!totals.balanced || !filled.length}>
              Save and new
            </Button>
          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
}
