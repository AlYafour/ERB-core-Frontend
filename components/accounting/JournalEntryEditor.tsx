'use client';

/**
 * JournalEntryEditor — THE single component for journal entries.
 * One QuickBooks-style layout serves all three flows:
 *   create  (no entry prop)         → editable, Save / Save and new
 *   view    (entry, any status)     → read-only grid + Post / Reverse / Edit
 *   edit    (draft entry, editing)  → same grid editable, Save changes
 *
 * Field mapping: Name→partner, Tax→tax code, Location→project,
 * Class→cost code, Journal no.→reference (real number stamped at posting).
 *
 * Visual shell matches every other detail page in the system:
 * PageHeader (breadcrumbs + actions) and `card` sections with
 * proc-section-head titles — no bespoke chrome.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Badge, PageHeader } from '@/components/ui';
import { ProcField } from '@/components/procurement/shared/ProcField';
import { accountingApi, type JournalEntry } from '@/lib/api/accounting';
import { costCodesApi } from '@/lib/api/cost-codes';
import { projectsApi } from '@/lib/api/projects';
import { suppliersApi } from '@/lib/api/suppliers';
import { customersApi } from '@/lib/api/customers';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';

interface LineDraft {
  account: string;
  debit: string;
  credit: string;
  description: string;
  partner: string;      // '' | 'supplier:12' | 'customer:5'
  tax_code: string;
  project: string;
  cost_code: string;
}

const EMPTY: LineDraft = {
  account: '', debit: '', credit: '', description: '',
  partner: '', tax_code: '', project: '', cost_code: '',
};

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'info' | 'warning' | 'error'> = {
  draft: 'default', posted: 'success', reversed: 'warning', cancelled: 'error',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', pending_review: 'Pending Review', approved: 'Approved',
  posted: 'Posted', reversed: 'Reversed', cancelled: 'Cancelled',
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
  border: '1px solid var(--input-border, var(--border-subtle))', borderRadius: 'var(--radius-sm)',
  background: 'var(--input-bg, var(--bg-primary))', color: 'var(--text-primary)',
};
const RO_CELL: React.CSSProperties = { fontSize: 'var(--text-sm)', padding: '7px 8px', display: 'block' };
const HEAD_LBL: React.CSSProperties = {
  display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600,
  color: 'var(--text-secondary)', marginBottom: 4,
};

function entryToDrafts(entry: JournalEntry): LineDraft[] {
  return entry.lines.map(l => ({
    account: String(l.account ?? ''),
    debit: Number(l.debit) > 0 ? String(l.debit) : '',
    credit: Number(l.credit) > 0 ? String(l.credit) : '',
    description: l.description ?? '',
    partner: l.partner_type && l.partner_id ? `${l.partner_type}:${l.partner_id}` : '',
    tax_code: l.tax_code ? String(l.tax_code) : '',
    project: l.project ? String(l.project) : '',
    cost_code: l.cost_code ? String(l.cost_code) : '',
  }));
}

export default function JournalEntryEditor({ entry }: { entry?: JournalEntry }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isCreate = !entry;

  const [editing, setEditing] = useState(isCreate);
  const readOnly = !editing;

  const [journalDate, setJournalDate] = useState(entry?.posting_date ?? today());
  const [journalNo, setJournalNo]     = useState(entry?.reference ?? '');
  const [memo, setMemo]               = useState(entry?.memo ?? '');
  const [lines, setLines]             = useState<LineDraft[]>(
    entry ? entryToDrafts(entry) : Array.from({ length: 4 }, () => ({ ...EMPTY })));
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [reverseOpen, setReverseOpen]   = useState(false);
  const [reverseReason, setReverseReason] = useState('');

  /* ── Dropdown data (names resolve even in read-only mode) ── */
  const { data: accData } = useQuery({
    queryKey: ['acc-postable-accounts'],
    queryFn: () => accountingApi.listAccounts({ page_size: 500, is_postable: true, is_active: true }),
    staleTime: 5 * 60 * 1000,
  });
  const { data: taxData } = useQuery({
    queryKey: ['acc-tax-codes'], queryFn: () => accountingApi.listTaxCodes(), staleTime: 5 * 60 * 1000,
  });
  const { data: ccData } = useQuery({
    queryKey: ['cost-codes-all'], queryFn: () => costCodesApi.getAll(), staleTime: 5 * 60 * 1000,
  });
  const { data: projData } = useQuery({
    queryKey: ['projects-for-je'], queryFn: () => projectsApi.getAll({ page_size: 300 } as any),
    staleTime: 5 * 60 * 1000,
  });
  const { data: supData } = useQuery({
    queryKey: ['suppliers-for-je'], queryFn: () => suppliersApi.getAllActive(), staleTime: 5 * 60 * 1000,
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

  const accLabel  = (id: string) => { const a = accounts.find((x: any) => String(x.id) === id); return a ? `${a.code} — ${a.name}` : id; };
  const taxLabel  = (id: string) => taxCodes.find((t: any) => String(t.id) === id)?.code ?? '';
  const projLabel = (id: string) => { const p = projects.find((x: any) => String(x.id) === id); return p ? (p.code ? `${p.code} — ${p.name}` : p.name) : ''; };
  const ccLabel   = (id: string) => costCodes.find((c: any) => String(c.id) === id)?.excel_code ?? '';
  const partnerLabel = (v: string) => {
    if (!v) return '';
    const [t, id] = v.split(':');
    if (t === 'supplier') return suppliers.find((s: any) => String(s.id) === id)?.name ?? `Supplier #${id}`;
    return customers.find((c: any) => String(c.id) === id)?.name ?? `Customer #${id}`;
  };

  /* ── Line helpers ── */
  const setLine = (idx: number, patch: Partial<LineDraft>) =>
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLines = (n = 4) => setLines(prev => [...prev, ...Array.from({ length: n }, () => ({ ...EMPTY }))]);
  const copyLine = (idx: number) => setLines(prev => [...prev.slice(0, idx + 1), { ...prev[idx] }, ...prev.slice(idx + 1)]);
  const removeLine = (idx: number) => setLines(prev => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  const clearAll = () => setLines(Array.from({ length: 4 }, () => ({ ...EMPTY })));

  const totals = useMemo(() => {
    const debit  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
    const credit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.005 && debit > 0 };
  }, [lines]);

  const filled = lines.filter(l => l.account && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
  const visibleLines = readOnly ? lines.filter(l => l.account) : lines;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['acc-journal'] });
    queryClient.invalidateQueries({ queryKey: ['acc-journal-one'] });
  };

  const buildPayload = () => ({
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
  });

  /* ── Mutations ── */
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = buildPayload();
      const saved = isCreate
        ? await accountingApi.createJournal(payload)
        : await accountingApi.updateJournal(entry!.id, payload);
      for (const f of pendingFiles) {
        try { await accountingApi.uploadJournalAttachment(saved.id, f); }
        catch { toast(`Attachment "${f.name}" failed to upload`, 'error'); }
      }
      return saved;
    },
    onSuccess: () => invalidate(),
  });

  const postMutation = useMutation({
    mutationFn: () => accountingApi.postJournal(entry!.id),
    onSuccess: () => { invalidate(); toast('Entry posted to the general ledger', 'success'); router.refresh(); },
    onError: (err: unknown) => toast(getApiError(err, 'Posting failed'), 'error'),
  });

  const reverseMutation = useMutation({
    mutationFn: () => accountingApi.reverseJournal(entry!.id, reverseReason),
    onSuccess: (rev) => { invalidate(); toast(`Reversal ${rev.number} created`, 'success'); router.push('/accounting/journal'); },
    onError: (err: unknown) => toast(getApiError(err, 'Reversal failed'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => accountingApi.deleteJournal(entry!.id),
    onSuccess: () => { invalidate(); toast('Draft deleted', 'success'); router.push('/accounting/journal'); },
    onError: (err: unknown) => toast(getApiError(err, 'Delete failed'), 'error'),
  });

  const uploadNow = async (files: File[]) => {
    for (const f of files) {
      try {
        await accountingApi.uploadJournalAttachment(entry!.id, f);
      } catch (err) {
        toast(getApiError(err, `Upload failed: ${f.name}`), 'error');
      }
    }
    invalidate(); router.refresh();
  };

  const save = async (andNew: boolean) => {
    if (!filled.length) { toast('Add at least two lines with amounts', 'error'); return; }
    if (!totals.balanced) { toast(`Entry is off by ${fmt(Math.abs(totals.debit - totals.credit))} — debits must equal credits`, 'error'); return; }
    try {
      await saveMutation.mutateAsync();
      toast(isCreate ? 'Journal entry saved as draft' : 'Changes saved', 'success');
      if (isCreate && andNew) {
        setJournalNo(''); setMemo(''); setPendingFiles([]); clearAll();
      } else if (isCreate) {
        router.push('/accounting/journal');
      } else {
        setEditing(false); setPendingFiles([]); router.refresh();
      }
    } catch (err) {
      toast(getApiError(err, 'Failed to save journal entry'), 'error');
    }
  };

  const handlePost = async () => {
    if (await confirm('Post this entry to the general ledger? Posted entries are immutable.')) {
      postMutation.mutate();
    }
  };
  const handleDelete = async () => {
    if (await confirm('Delete this draft entry permanently?')) deleteMutation.mutate();
  };
  const handleClose = async () => {
    if (editing && filled.length && !(await confirm('Discard unsaved changes?'))) return;
    router.push('/accounting/journal');
  };

  const isDraft  = entry?.status === 'draft';
  const isPosted = entry?.status === 'posted';

  const headerActions = (
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
      {entry && (
        <Badge variant={STATUS_VARIANT[entry.status] ?? 'default'}>
          {STATUS_LABEL[entry.status] ?? entry.status}
        </Badge>
      )}
      {isCreate && (
        <>
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={saveMutation.isPending}>Cancel</Button>
          <Button variant="secondary" size="sm" onClick={() => save(false)} isLoading={saveMutation.isPending}
                  disabled={!totals.balanced || !filled.length}>Save</Button>
          <Button variant="primary" size="sm" onClick={() => save(true)} isLoading={saveMutation.isPending}
                  disabled={!totals.balanced || !filled.length}>Save and new</Button>
        </>
      )}
      {isDraft && !editing && (
        <>
          <Button variant="destructive" size="sm" onClick={handleDelete} isLoading={deleteMutation.isPending}>
            Delete draft
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="success" size="sm" onClick={handlePost} isLoading={postMutation.isPending}>Post</Button>
        </>
      )}
      {isDraft && editing && (
        <>
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={saveMutation.isPending}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={() => save(false)} isLoading={saveMutation.isPending}
                  disabled={!totals.balanced || !filled.length}>Save changes</Button>
        </>
      )}
      {isPosted && !reverseOpen && (
        <Button variant="secondary" size="sm" onClick={() => setReverseOpen(true)}>Reverse</Button>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        title={isCreate ? 'New Journal Entry' : `Journal Entry ${entry!.number || '(draft)'}`}
        description="General ledger journal entry — double-sided, balanced, auditable."
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Accounting' },
          { label: 'Journal Entries', href: '/accounting/journal' },
          { label: isCreate ? 'New' : (entry!.number || 'Draft') },
        ]}
        backHref="/accounting/journal"
        actions={headerActions}
      />

      {/* ── Entry details ── */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="proc-section-head">
          <h3 className="proc-section-title">Entry Details</h3>
        </div>
        {editing ? (
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div>
              <label style={HEAD_LBL}>Journal date <span style={{ color: 'var(--status-error)' }}>*</span></label>
              <input type="date" value={journalDate} onChange={e => setJournalDate(e.target.value)}
                     style={{ ...CELL_INPUT, width: 180 }} />
            </div>
            <div style={{ flex: 1, minWidth: 220, maxWidth: 420 }}>
              <label style={HEAD_LBL}>Journal no.</label>
              <input type="text" value={journalNo} onChange={e => setJournalNo(e.target.value)}
                     placeholder="Reference — official number is assigned when posted"
                     style={{ ...CELL_INPUT, width: '100%' }} />
            </div>
          </div>
        ) : (
          <div className="proc-info-grid">
            <ProcField label="Journal Date" value={journalDate} />
            <ProcField label="Journal No." value={<span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{entry?.number || journalNo || '—'}</span>} />
            <ProcField label="Source" value={
              entry?.source_module === 'purchase_invoices' && entry?.source_id ? (
                <Link href={`/purchase-invoices/${entry.source_id}`} style={{ color: 'var(--brand)', fontWeight: 'var(--weight-semibold)', textDecoration: 'none' }}>
                  Supplier bill ↗
                </Link>
              ) : entry?.source_module === 'manual' ? 'Manual' : `${entry?.source_module} · ${entry?.event_code}`
            } />
            <ProcField label="Created By" value={entry?.created_by_name || '—'} />
            {entry?.posted_by_name && <ProcField label="Posted By" value={entry.posted_by_name} />}
            {entry?.reversal_of_number && <ProcField label="Reverses" value={entry.reversal_of_number} />}
          </div>
        )}
      </div>

      {/* ── Lines ── */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="proc-section-head">
          <h3 className="proc-section-title">Lines</h3>
          {(totals.debit > 0 || totals.credit > 0) && (
            <Badge variant={totals.balanced ? 'success' : 'warning'}>
              {totals.balanced ? 'Balanced' : `Off by ${fmt(Math.abs(totals.debit - totals.credit))}`}
            </Badge>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: readOnly ? 980 : 1150 }}>
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
                {!readOnly && <th style={{ ...TH, width: 64 }} />}
              </tr>
            </thead>
            <tbody>
              {visibleLines.map((line, idx) => (
                <tr key={idx}>
                  <td style={{ ...TD, color: 'var(--text-tertiary)', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={TD}>
                    {readOnly ? <span style={RO_CELL}>{accLabel(line.account)}</span> : (
                      <select value={line.account} onChange={e => setLine(idx, { account: e.target.value })} style={CELL_INPUT}>
                        <option value="" />
                        {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={{ ...TD, textAlign: 'right' }}>
                    {readOnly ? <span className="font-mono" style={RO_CELL}>{line.debit ? fmt(parseFloat(line.debit)) : ''}</span> : (
                      <input type="number" min="0" step="0.01" value={line.debit}
                             onChange={e => setLine(idx, { debit: e.target.value, credit: e.target.value ? '' : line.credit })}
                             style={{ ...CELL_INPUT, textAlign: 'right' }} />
                    )}
                  </td>
                  <td style={{ ...TD, textAlign: 'right' }}>
                    {readOnly ? <span className="font-mono" style={RO_CELL}>{line.credit ? fmt(parseFloat(line.credit)) : ''}</span> : (
                      <input type="number" min="0" step="0.01" value={line.credit}
                             onChange={e => setLine(idx, { credit: e.target.value, debit: e.target.value ? '' : line.debit })}
                             style={{ ...CELL_INPUT, textAlign: 'right' }} />
                    )}
                  </td>
                  <td style={TD}>
                    {readOnly ? <span style={RO_CELL}>{line.description}</span> : (
                      <input type="text" value={line.description} onChange={e => setLine(idx, { description: e.target.value })} style={CELL_INPUT} />
                    )}
                  </td>
                  <td style={TD}>
                    {readOnly ? <span style={RO_CELL}>{partnerLabel(line.partner)}</span> : (
                      <select value={line.partner} onChange={e => setLine(idx, { partner: e.target.value })} style={CELL_INPUT}>
                        <option value="" />
                        <optgroup label="Suppliers">
                          {suppliers.map((s: any) => <option key={`s${s.id}`} value={`supplier:${s.id}`}>{s.name}</option>)}
                        </optgroup>
                        <optgroup label="Customers">
                          {customers.map((c: any) => <option key={`c${c.id}`} value={`customer:${c.id}`}>{c.name || c.business_name}</option>)}
                        </optgroup>
                      </select>
                    )}
                  </td>
                  <td style={TD}>
                    {readOnly ? <span style={RO_CELL}>{taxLabel(line.tax_code)}</span> : (
                      <select value={line.tax_code} onChange={e => setLine(idx, { tax_code: e.target.value })} style={CELL_INPUT}>
                        <option value="" />
                        {taxCodes.map((t: any) => <option key={t.id} value={t.id}>{t.code}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={TD}>
                    {readOnly ? <span style={RO_CELL}>{projLabel(line.project)}</span> : (
                      <select value={line.project} onChange={e => setLine(idx, { project: e.target.value })} style={CELL_INPUT}>
                        <option value="" />
                        {projects.map((p: any) => <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.name}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={TD}>
                    {readOnly ? <span style={RO_CELL}>{ccLabel(line.cost_code)}</span> : (
                      <select value={line.cost_code} onChange={e => setLine(idx, { cost_code: e.target.value })} style={CELL_INPUT}>
                        <option value="" />
                        {costCodes.map((c: any) => <option key={c.id} value={c.id}>{c.excel_code}</option>)}
                      </select>
                    )}
                  </td>
                  {!readOnly && (
                    <td style={{ ...TD, whiteSpace: 'nowrap', textAlign: 'center' }}>
                      <button onClick={() => copyLine(idx)} title="Duplicate line" aria-label={`Duplicate line ${idx + 1}`}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 3 }}>⧉</button>
                      <button onClick={() => removeLine(idx)} title="Delete line" aria-label={`Delete line ${idx + 1}`}
                              disabled={lines.length <= 1}
                              style={{ background: 'none', border: 'none', cursor: lines.length > 1 ? 'pointer' : 'not-allowed', color: 'var(--status-error)', padding: 3 }}>🗑</button>
                    </td>
                  )}
                </tr>
              ))}
              <tr>
                <td style={TD} />
                <td style={{ ...TD, textAlign: 'right', fontWeight: 700 }}>Total</td>
                <td style={{ ...TD, textAlign: 'right', fontWeight: 700 }} className="font-mono">AED {fmt(totals.debit)}</td>
                <td style={{ ...TD, textAlign: 'right', fontWeight: 700 }} className="font-mono">AED {fmt(totals.credit)}</td>
                <td colSpan={5} style={TD} />
                {!readOnly && <td style={TD} />}
              </tr>
            </tbody>
          </table>
        </div>
        {!readOnly && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            <Button variant="secondary" size="sm" onClick={() => addLines(4)}>Add lines</Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>Clear all lines</Button>
          </div>
        )}
      </div>

      {/* ── Memo + attachments ── */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="proc-section-head">
          <h3 className="proc-section-title">Memo &amp; Attachments</h3>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <label style={HEAD_LBL}>Memo</label>
            {editing ? (
              <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={4}
                        style={{ ...CELL_INPUT, resize: 'vertical' }} />
            ) : (
              <p style={{ ...RO_CELL, whiteSpace: 'pre-wrap', margin: 0 }}>{memo || '—'}</p>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <label style={HEAD_LBL}>Attachments</label>
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, minHeight: 72, padding: 'var(--space-3)', cursor: 'pointer',
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
                       if (isCreate) setPendingFiles(prev => [...prev, ...ok]);
                       else uploadNow(ok);
                       e.target.value = '';
                     }} />
            </label>
            {(entry?.attachments?.length || pendingFiles.length) ? (
              <ul style={{ listStyle: 'none', margin: 'var(--space-2) 0 0', padding: 0, fontSize: 'var(--text-sm)' }}>
                {entry?.attachments?.map(a => (
                  <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                    {a.url
                      ? <a href={a.url} target="_blank" rel="noreferrer" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--brand, #b8860b)' }}>{a.name}</a>
                      : <span>{a.name}</span>}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>{(a.size / 1024).toFixed(0)} KB</span>
                      <button onClick={async () => {
                        if (await confirm(`Remove attachment "${a.name}"?`)) {
                          try {
                            await accountingApi.deleteJournalAttachment(entry!.id, a.id);
                            invalidate(); router.refresh();
                          } catch (err) { toast(getApiError(err, 'Delete failed'), 'error'); }
                        }
                      }} style={{ background: 'none', border: 'none', color: 'var(--status-error)', cursor: 'pointer' }}>×</button>
                    </span>
                  </li>
                ))}
                {pendingFiles.map((f, i) => (
                  <li key={`p${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name} <em style={{ color: 'var(--text-tertiary)' }}>(uploads on save)</em></span>
                    <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                            style={{ background: 'none', border: 'none', color: 'var(--status-error)', cursor: 'pointer' }}>×</button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Reverse reason ── */}
      {reverseOpen && (
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="proc-section-head">
            <h3 className="proc-section-title">Reverse Entry</h3>
          </div>
          <label style={HEAD_LBL}>Reversal reason <span style={{ color: 'var(--status-error)' }}>*</span></label>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <input type="text" value={reverseReason} onChange={e => setReverseReason(e.target.value)}
                   placeholder="Why is this entry being reversed?" style={{ ...CELL_INPUT, flex: 1, minWidth: 240 }} />
            <Button variant="destructive" size="sm" onClick={() => reverseMutation.mutate()}
                    isLoading={reverseMutation.isPending} disabled={!reverseReason.trim()}>
              Confirm reversal
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setReverseOpen(false); setReverseReason(''); }}>Cancel</Button>
          </div>
        </div>
      )}
    </>
  );
}
