'use client';

/**
 * ExpenseForm — create/edit a petty-cash expense voucher on the standard
 * shell (PageHeader + card sections + ProcField-style fields). Mirrors the
 * SAIF/GHAITH sheet: cash box, cost type, project, cost code, supplier,
 * invoice, VAT, receipt attachment. Receipts chosen before save upload
 * right after the voucher is created.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, Button, PageHeader, Badge } from '@/components/ui';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { expensesApi, type Expense, type CostType } from '@/lib/api/expenses';
import { accountingApi } from '@/lib/api/accounting';
import { costCodesApi } from '@/lib/api/cost-codes';
import { projectsApi } from '@/lib/api/projects';
import { suppliersApi } from '@/lib/api/suppliers';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { formatPrice } from '@/lib/utils/format';

const today = () => new Date().toISOString().slice(0, 10);
const LABEL: React.CSSProperties = { display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 };
const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 'var(--text-sm)',
  border: '1px solid var(--input-border, var(--border-subtle))', borderRadius: 'var(--radius-sm)',
  background: 'var(--input-bg, var(--bg-primary))', color: 'var(--text-primary)', boxSizing: 'border-box',
};
const GRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' };

export default function ExpenseForm({ existing }: { existing?: Expense }) {
  const router = useRouter();
  const isEdit = !!existing;

  const [voucher, setVoucher] = useState(existing?.voucher_number ?? '');
  const [cashBox, setCashBox] = useState<string | null>(existing?.cash_box ?? null);
  const [date, setDate] = useState(existing?.expense_date ?? today());
  const [costType, setCostType] = useState<CostType>(existing?.cost_type ?? 'direct');
  const [project, setProject] = useState<number | null>(existing?.project ?? null);
  const [costCode, setCostCode] = useState<number | null>(existing?.cost_code ?? null);
  const [supplier, setSupplier] = useState<number | null>(existing?.supplier ?? null);
  const [payee, setPayee] = useState(existing?.payee_name ?? '');
  const [invoiceNo, setInvoiceNo] = useState(existing?.invoice_no ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [vatLiable, setVatLiable] = useState(existing?.vat_liable ?? false);
  const [vatAmount, setVatAmount] = useState(existing ? String(existing.vat_amount) : '');
  const [files, setFiles] = useState<File[]>([]);

  const { data: boxData } = useQuery({ queryKey: ['acc-bank-accounts'], queryFn: () => accountingApi.listBankAccounts(), staleTime: 300_000 });
  const { data: ccData }  = useQuery({ queryKey: ['cost-codes-all'], queryFn: () => costCodesApi.getAll(), staleTime: 300_000 });
  const { data: projData }= useQuery({ queryKey: ['projects-for-exp'], queryFn: () => projectsApi.getAll({ page_size: 300 } as any), staleTime: 300_000 });
  const { data: supData } = useQuery({ queryKey: ['suppliers-active'], queryFn: () => suppliersApi.getAllActive(), staleTime: 300_000 });

  const boxes = (boxData as any)?.results ?? [];
  const costCodes = Array.isArray(ccData) ? ccData : ((ccData as any)?.results ?? []);
  const projects = (projData as any)?.results ?? [];
  const suppliers = supData ?? [];

  const boxOpts = boxes.map((b: any) => ({ value: b.id, label: `${b.name} (${b.kind === 'petty_cash' ? 'Petty Cash' : 'Bank'})` }));
  const projectOpts = projects.map((p: any) => ({ value: p.id, label: p.code ? `${p.code} — ${p.name}` : p.name }));
  const costCodeOpts = costCodes.map((c: any) => ({ value: c.id, label: `${c.excel_code} — ${String(c.description || '').slice(0, 40)}` }));
  const supplierOpts = suppliers.map((s: any) => ({ value: s.id, label: s.business_name || s.name }));

  const netAmount = useMemo(() => {
    const a = parseFloat(amount) || 0;
    const v = vatLiable ? (parseFloat(vatAmount) || 0) : 0;
    return a - v;
  }, [amount, vatAmount, vatLiable]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        voucher_number: voucher, cash_box: cashBox, expense_date: date,
        cost_type: costType, project, cost_code: costCode, supplier,
        payee_name: payee, invoice_no: invoiceNo, description,
        amount, vat_liable: vatLiable, vat_amount: vatLiable ? vatAmount || '0' : '0',
      };
      const saved = isEdit
        ? await expensesApi.update(existing!.id, payload)
        : await expensesApi.create(payload);
      for (const f of files) {
        try { await expensesApi.uploadAttachment(saved.id, f); }
        catch { toast(`Receipt "${f.name}" failed to upload`, 'error'); }
      }
      return saved;
    },
    onSuccess: (saved) => {
      toast(isEdit ? 'Expense updated' : 'Expense created', 'success');
      router.push(`/expenses/${saved.id}`);
    },
    onError: (err) => toast(getApiError(err, 'Failed to save expense'), 'error'),
  });

  const handleSave = () => {
    if (!amount || parseFloat(amount) <= 0) { toast('Enter an amount greater than zero', 'error'); return; }
    if (vatLiable && !supplier) { toast('VAT-liable expenses need a supplier (with TRN)', 'error'); return; }
    saveMutation.mutate();
  };
  const handleCancel = async () => {
    if ((amount || voucher) && !isEdit && !(await confirm('Discard this expense?'))) return;
    router.push('/expenses');
  };

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={isEdit ? `Edit ${existing!.voucher_number || existing!.number}` : 'New Expense'}
          description="Petty-cash / cash expense voucher"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Petty Cash & Expenses', href: '/expenses' }, { label: isEdit ? 'Edit' : 'New' }]}
          backHref="/expenses"
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saveMutation.isPending}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleSave} isLoading={saveMutation.isPending}>{isEdit ? 'Save changes' : 'Save'}</Button>
            </div>
          }
        />

        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="proc-section-head"><h3 className="proc-section-title">Voucher</h3></div>
          <div style={GRID}>
            <div><label style={LABEL}>Voucher Number</label>
              <input style={INPUT} value={voucher} onChange={e => setVoucher(e.target.value)} placeholder="e.g. 01-GHP" /></div>
            <div><label style={LABEL}>Date <span style={{ color: 'var(--status-error)' }}>*</span></label>
              <input type="date" style={INPUT} value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><label style={LABEL}>Cash Box</label>
              <SearchableDropdown options={boxOpts} value={cashBox} onChange={v => setCashBox(v ? String(v) : null)} placeholder="Petty cash / bank" allowClear /></div>
            <div><label style={LABEL}>Cost Type</label>
              <select style={INPUT} value={costType} onChange={e => setCostType(e.target.value as CostType)}>
                <option value="direct">Direct (D.C)</option>
                <option value="indirect">Indirect (I.D.C)</option>
                <option value="office">Office / Overhead</option>
              </select></div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="proc-section-head"><h3 className="proc-section-title">Coding</h3></div>
          <div style={GRID}>
            <div><label style={LABEL}>Project</label>
              <SearchableDropdown options={projectOpts} value={project} onChange={v => setProject(v ? Number(v) : null)} placeholder="Project (optional)" allowClear /></div>
            <div><label style={LABEL}>Cost Code</label>
              <SearchableDropdown options={costCodeOpts} value={costCode} onChange={v => setCostCode(v ? Number(v) : null)} placeholder="Cost code" allowClear /></div>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 8 }}>
            The cost code determines which expense account this posts to. Without it, it falls to the default expense account.
          </p>
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="proc-section-head"><h3 className="proc-section-title">Supplier &amp; Invoice</h3></div>
          <div style={GRID}>
            <div><label style={LABEL}>Supplier {vatLiable && <span style={{ color: 'var(--status-error)' }}>*</span>}</label>
              <SearchableDropdown options={supplierOpts} value={supplier} onChange={v => setSupplier(v ? Number(v) : null)} placeholder="Supplier" allowClear /></div>
            <div><label style={LABEL}>Payee / Plate (free text)</label>
              <input style={INPUT} value={payee} onChange={e => setPayee(e.target.value)} placeholder="e.g. plate no / employee" /></div>
            <div><label style={LABEL}>Invoice No.</label>
              <input style={INPUT} value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} /></div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="proc-section-head"><h3 className="proc-section-title">Amount</h3></div>
          <div style={GRID}>
            <div><label style={LABEL}>Gross Amount (AED) <span style={{ color: 'var(--status-error)' }}>*</span></label>
              <input type="number" min="0" step="0.01" style={INPUT} value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div>
              <label style={LABEL}>VAT</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38 }}>
                <input type="checkbox" checked={vatLiable} onChange={e => setVatLiable(e.target.checked)} style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 'var(--text-sm)' }}>VAT liable</span>
              </label>
            </div>
            {vatLiable && (
              <div><label style={LABEL}>VAT Amount (AED)</label>
                <input type="number" min="0" step="0.01" style={INPUT} value={vatAmount} onChange={e => setVatAmount(e.target.value)} /></div>
            )}
            <div><label style={LABEL}>Net (to expense account)</label>
              <div style={{ ...INPUT, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center' }} className="font-mono">{formatPrice(netAmount)}</div></div>
          </div>
          <div style={{ marginTop: 'var(--space-3)' }}>
            <label style={LABEL}>Description</label>
            <textarea style={{ ...INPUT, resize: 'vertical' }} rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="What was this for?" />
          </div>
        </div>

        <div className="card">
          <div className="proc-section-head"><h3 className="proc-section-title">Receipt / Attachments</h3></div>
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 4, minHeight: 72, padding: 'var(--space-3)', cursor: 'pointer',
            border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)', fontSize: 'var(--text-sm)',
          }}>
            <span style={{ color: 'var(--brand, #b8860b)', fontWeight: 600 }}>Add receipt</span>
            <span style={{ fontSize: 'var(--text-xs)' }}>Max 20 MB {isEdit ? '' : '— uploads when you save'}</span>
            <input type="file" multiple hidden onChange={e => {
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
                  <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--status-error)', cursor: 'pointer' }}>×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PageShell>
    </MainLayout>
  );
}
