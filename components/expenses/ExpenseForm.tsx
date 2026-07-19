'use client';

/**
 * ExpenseForm — create/edit a petty-cash expense voucher. Compact layout on
 * the standard shell. Voucher number is assigned automatically (EXP-YYYY-…);
 * Cash Box and Supplier are add-able dropdowns (create inline). Mirrors the
 * SAIF/GHAITH sheet: cash box, cost type, project, cost code, supplier,
 * invoice, VAT, receipt.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, Button, PageHeader } from '@/components/ui';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { expensesApi, type Expense, type CostType } from '@/lib/api/expenses';
import { costCodesApi } from '@/lib/api/cost-codes';
import { projectsApi } from '@/lib/api/projects';
import { suppliersApi } from '@/lib/api/suppliers';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { formatPrice } from '@/lib/utils/format';

const today = () => new Date().toISOString().slice(0, 10);
const LABEL: React.CSSProperties = { display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 3 };
const INPUT: React.CSSProperties = {
  width: '100%', padding: '7px 9px', fontSize: 'var(--text-sm)',
  border: '1px solid var(--input-border, var(--border-subtle))', borderRadius: 'var(--radius-sm)',
  background: 'var(--input-bg, var(--bg-primary))', color: 'var(--text-primary)', boxSizing: 'border-box',
};
const GRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' };

export default function ExpenseForm({ existing }: { existing?: Expense }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = !!existing;

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

  const { data: boxes = [] }   = useQuery({ queryKey: ['exp-cash-boxes'], queryFn: () => expensesApi.listCashBoxes(), staleTime: 300_000 });
  const { data: ccData }       = useQuery({ queryKey: ['cost-codes-all'], queryFn: () => costCodesApi.getAll(), staleTime: 300_000 });
  const { data: projData }     = useQuery({ queryKey: ['projects-for-exp'], queryFn: () => projectsApi.getAll({ page_size: 300 } as any), staleTime: 300_000 });
  const { data: supData = [] } = useQuery({ queryKey: ['suppliers-active'], queryFn: () => suppliersApi.getAllActive(), staleTime: 300_000 });

  const costCodes = Array.isArray(ccData) ? ccData : ((ccData as any)?.results ?? []);
  const projects = (projData as any)?.results ?? [];

  const boxOpts = boxes.map(b => ({ value: b.id, label: `${b.name}${b.kind === 'petty_cash' ? '' : ' (Bank)'}` }));
  const projectOpts = projects.map((p: any) => ({ value: p.id, label: p.code ? `${p.code} — ${p.name}` : p.name }));
  const costCodeOpts = costCodes.map((c: any) => ({ value: c.id, label: `${c.excel_code} — ${String(c.description || '').slice(0, 40)}` }));
  const supplierOpts = supData.map((s: any) => ({ value: s.id, label: s.business_name || s.name }));

  const netAmount = useMemo(() => {
    const a = parseFloat(amount) || 0;
    const v = vatLiable ? (parseFloat(vatAmount) || 0) : 0;
    return a - v;
  }, [amount, vatAmount, vatLiable]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        cash_box: cashBox, expense_date: date, cost_type: costType,
        project, cost_code: costCode, supplier, payee_name: payee,
        invoice_no: invoiceNo, description, amount,
        vat_liable: vatLiable, vat_amount: vatLiable ? vatAmount || '0' : '0',
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
    if ((amount || cashBox) && !isEdit && !(await confirm('Discard this expense?'))) return;
    router.push('/expenses');
  };

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={isEdit ? `Edit ${existing!.voucher_number || existing!.number}` : 'New Expense'}
          description="Petty-cash / cash expense voucher — the voucher number is assigned automatically."
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
          <div style={GRID}>
            <div><label style={LABEL}>Date <span style={{ color: 'var(--status-error)' }}>*</span></label>
              <input type="date" style={INPUT} value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><label style={LABEL}>Cash Box</label>
              <SearchableDropdown options={boxOpts} value={cashBox} allowClear placeholder="Select or add a box"
                onChange={v => setCashBox(v ? String(v) : null)}
                onCreateOption={async name => {
                  try {
                    const b = await expensesApi.createCashBox(name);
                    queryClient.invalidateQueries({ queryKey: ['exp-cash-boxes'] });
                    return { value: b.id, label: b.name };
                  } catch (err) { toast(getApiError(err, 'Could not add box'), 'error'); return null; }
                }} /></div>
            <div><label style={LABEL}>Cost Type</label>
              <select style={INPUT} value={costType} onChange={e => setCostType(e.target.value as CostType)}>
                <option value="direct">Direct (project)</option>
                <option value="indirect">Indirect</option>
                <option value="office">Office / Overhead</option>
              </select></div>
            <div><label style={LABEL}>Project</label>
              <SearchableDropdown options={projectOpts} value={project} allowClear placeholder="Which project"
                onChange={v => setProject(v ? Number(v) : null)} /></div>
            <div><label style={LABEL}>Cost Code</label>
              <SearchableDropdown options={costCodeOpts} value={costCode} allowClear placeholder="Expense category"
                onChange={v => setCostCode(v ? Number(v) : null)} /></div>
            <div><label style={LABEL}>Supplier {vatLiable && <span style={{ color: 'var(--status-error)' }}>*</span>}</label>
              <SearchableDropdown options={supplierOpts} value={supplier} allowClear placeholder="Select or add supplier"
                onChange={v => setSupplier(v ? Number(v) : null)}
                onCreateOption={async name => {
                  try {
                    const s: any = await suppliersApi.create({ name, business_name: name } as any);
                    queryClient.invalidateQueries({ queryKey: ['suppliers-active'] });
                    return { value: s.id, label: s.business_name || s.name };
                  } catch (err) { toast(getApiError(err, 'Could not add supplier'), 'error'); return null; }
                }} /></div>
            <div><label style={LABEL}>Payee / Vehicle plate</label>
              <input style={INPUT} value={payee} onChange={e => setPayee(e.target.value)} placeholder="If no supplier — who / which vehicle" /></div>
            <div><label style={LABEL}>Invoice No.</label>
              <input style={INPUT} value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} /></div>
          </div>
          <div style={{ marginTop: 'var(--space-3)' }}>
            <label style={LABEL}>Description</label>
            <input style={INPUT} value={description} onChange={e => setDescription(e.target.value)} placeholder="What was this for?" />
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 150 }}><label style={LABEL}>Gross (AED) <span style={{ color: 'var(--status-error)' }}>*</span></label>
              <input type="number" min="0" step="0.01" style={INPUT} value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, height: 34 }}>
              <input type="checkbox" checked={vatLiable} onChange={e => setVatLiable(e.target.checked)} style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 'var(--text-sm)' }}>VAT liable</span>
            </label>
            {vatLiable && (
              <div style={{ minWidth: 130 }}><label style={LABEL}>VAT (AED)</label>
                <input type="number" min="0" step="0.01" style={INPUT} value={vatAmount} onChange={e => setVatAmount(e.target.value)} /></div>
            )}
            <div style={{ minWidth: 130 }}><label style={LABEL}>Net</label>
              <div style={{ ...INPUT, background: 'var(--bg-secondary)' }} className="font-mono">{formatPrice(netAmount)}</div></div>

            <label style={{
              marginInlineStart: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', cursor: 'pointer', border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-md)', color: 'var(--brand, #b8860b)', fontWeight: 600, fontSize: 'var(--text-sm)',
            }}>
              📎 Add receipt
              <input type="file" multiple hidden onChange={e => {
                const chosen = Array.from(e.target.files ?? []).filter(f => f.size <= 20 * 1024 * 1024);
                if (chosen.length < (e.target.files?.length ?? 0)) toast('Some files exceed 20 MB and were skipped', 'error');
                setFiles(prev => [...prev, ...chosen]); e.target.value = '';
              }} />
            </label>
          </div>
          {files.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 'var(--space-2) 0 0', padding: 0, fontSize: 'var(--text-sm)' }}>
              {files.map((f, i) => (
                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', maxWidth: 360 }}>
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
