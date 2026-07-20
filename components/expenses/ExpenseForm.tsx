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
import { expensesApi, type Expense } from '@/lib/api/expenses';
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
  const [costType, setCostType] = useState<string | null>(existing?.cost_type ?? null);
  const [project, setProject] = useState<number | null>(existing?.project ?? null);
  const [overhead, setOverhead] = useState<string | null>((existing as any)?.overhead_category ?? null);
  const [costCode, setCostCode] = useState<number | null>(existing?.cost_code ?? null);
  const [supplier, setSupplier] = useState<number | null>(existing?.supplier ?? null);
  const [vehicle, setVehicle] = useState<number | null>(existing?.vehicle ?? null);
  const [payee, setPayee] = useState(existing?.payee_name ?? '');
  const [invoiceNo, setInvoiceNo] = useState(existing?.invoice_no ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [vatLiable, setVatLiable] = useState(existing?.vat_liable ?? false);
  const [files, setFiles] = useState<File[]>([]);

  const { data: boxes = [] }   = useQuery({ queryKey: ['exp-cash-boxes'], queryFn: () => expensesApi.listCashBoxes(), staleTime: 300_000 });
  // When editing, include inactive lookups too, so a voucher coded to a type /
  // office that was later deactivated still resolves (otherwise the form would
  // lock the cost code and silently drop the overhead context on save).
  const { data: costTypes = [] } = useQuery({ queryKey: ['exp-cost-types', isEdit], queryFn: () => expensesApi.listCostTypes(isEdit), staleTime: 300_000 });
  const { data: overheads = [] } = useQuery({ queryKey: ['exp-overheads', isEdit], queryFn: () => expensesApi.listOverheadCategories(isEdit), staleTime: 300_000 });
  const { data: ccData }       = useQuery({ queryKey: ['cost-codes-all'], queryFn: () => costCodesApi.getAll(), staleTime: 300_000 });
  const { data: projData }     = useQuery({ queryKey: ['projects-for-exp'], queryFn: () => projectsApi.getAll({ page_size: 300 } as any), staleTime: 300_000 });
  const { data: supData = [] } = useQuery({ queryKey: ['suppliers-active'], queryFn: () => suppliersApi.getAllActive(), staleTime: 300_000 });
  const { data: vehicles = [] } = useQuery({ queryKey: ['exp-vehicles'], queryFn: () => expensesApi.listVehicles(), staleTime: 300_000 });

  const allCostCodes = Array.isArray(ccData) ? ccData : ((ccData as any)?.results ?? []);
  const projects = (projData as any)?.results ?? [];

  // Show cost codes matching the selected cost type's direct/indirect nature.
  const selectedType = costTypes.find(c => c.id === costType);
  const costCodes = selectedType
    ? allCostCodes.filter((c: any) => (c.is_direct ?? true) === selectedType.is_direct)
    : allCostCodes;

  const boxOpts = boxes.map(b => ({ value: b.id, label: `${b.name}${b.custodian_name ? ` — ${b.custodian_name}` : ''}${b.kind === 'petty_cash' ? '' : ' (Bank)'}` }));
  const costTypeOpts = costTypes.map(c => ({ value: c.id, label: c.name }));
  const isIndirect = selectedType ? !selectedType.is_direct : false;
  const projectOpts = projects.map((p: any) => ({ value: p.id, label: p.code ? `${p.code} — ${p.name}` : p.name }));
  // Only pickable items (not the group headers), each labelled with its
  // group so repeated names like "OTHER" are never ambiguous.
  const costCodeOpts = costCodes
    .filter((c: any) => c.level !== 1)
    .map((c: any) => {
      const grp = c.parent_desc ? String(c.parent_desc).replace(/\s*[—-].*$/, '').trim().slice(0, 22) : '';
      return { value: c.id, label: `${c.excel_code} — ${String(c.description || '').replace(/\s*[—-].*$/, '').trim().slice(0, 34)}${grp ? `  ·  ${grp}` : ''}` };
    });
  const supplierOpts = supData.map((s: any) => ({ value: s.id, label: s.business_name || s.name }));
  const vehicleOpts = vehicles.map(v => ({ value: v.id, label: v.label }));

  // VAT is computed automatically — the gross is VAT-inclusive, so the 5% UAE
  // VAT is extracted from it (gross × 5/105). No manual entry.
  const { vatAmount, netAmount } = useMemo(() => {
    const g = parseFloat(amount) || 0;
    const v = vatLiable ? Math.round((g * 5 / 105) * 100) / 100 : 0;
    return { vatAmount: v, netAmount: g - v };
  }, [amount, vatLiable]);

  // Cash-box balance awareness: show the selected box's balance and warn when
  // this voucher would overdraw it (imprest safeguard).
  const selectedBox = boxes.find(b => b.id === cashBox);
  const boxBalance = selectedBox ? Number(selectedBox.balance ?? 0) : null;
  const grossNum = parseFloat(amount) || 0;
  const overSpend = boxBalance !== null && grossNum > 0 && grossNum > boxBalance;

  // The Vehicle picker only appears for vehicle/fleet cost codes (a code flagged
  // as a vehicle code, or any child of one).
  const selectedCostCode = allCostCodes.find((c: any) => c.id === costCode);
  const showVehicle = !!(selectedCostCode as any)?.is_vehicle_effective;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        cash_box: cashBox, expense_date: date, cost_type: costType,
        project: isIndirect ? null : project,
        overhead_category: isIndirect ? overhead : null,
        cost_code: costCode, supplier, vehicle, payee_name: payee,
        invoice_no: invoiceNo, description, amount,
        vat_liable: vatLiable, vat_amount: vatLiable ? vatAmount.toFixed(2) : '0',
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

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) { toast('Enter an amount greater than zero', 'error'); return; }
    if (vatLiable && !supplier) { toast('VAT-liable expenses need a supplier (with TRN)', 'error'); return; }
    if (overSpend && !(await confirm(
      `This amount (${formatPrice(grossNum)}) is more than the box balance (${formatPrice(boxBalance!)}). Record it anyway?`))) return;
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
                    const b = await expensesApi.createCashBox({ name });
                    queryClient.invalidateQueries({ queryKey: ['exp-cash-boxes'] });
                    return { value: b.id, label: b.name };
                  } catch (err) { toast(getApiError(err, 'Could not add box'), 'error'); return null; }
                }} />
              {selectedBox && (
                <div style={{ fontSize: 11, marginTop: 4, fontWeight: 600, color: overSpend ? 'var(--status-error)' : 'var(--text-muted)' }}>
                  Balance: <span style={{ fontFamily: 'monospace' }}>{formatPrice(boxBalance!)}</span>
                  {overSpend && ' — exceeds balance'}
                </div>
              )}
            </div>
            <div><label style={LABEL}>Cost Type</label>
              <SearchableDropdown options={costTypeOpts} value={costType} allowClear placeholder="Select or add a type"
                onChange={v => {
                  const id = v ? String(v) : null;
                  setCostType(id);
                  // Indirect/overhead is not project work — clear the project;
                  // also drop a cost code from the other catalog.
                  const t = costTypes.find(c => c.id === id);
                  if (t && !t.is_direct) setProject(null);
                  setCostCode(null);
                }}
                onCreateOption={async name => {
                  try {
                    const c = await expensesApi.createCostType(name);
                    queryClient.invalidateQueries({ queryKey: ['exp-cost-types'] });
                    return { value: c.id, label: c.name };
                  } catch (err) { toast(getApiError(err, 'Could not add type'), 'error'); return null; }
                }} /></div>
            {isIndirect ? (
              <div><label style={LABEL}>Office / Location</label>
                <SearchableDropdown options={overheads.map(o => ({ value: o.id, label: o.name }))} value={overhead} allowClear placeholder="Select or add"
                  onChange={v => setOverhead(v ? String(v) : null)}
                  onCreateOption={async name => {
                    try {
                      const o = await expensesApi.createOverheadCategory(name);
                      queryClient.invalidateQueries({ queryKey: ['exp-overheads'] });
                      return { value: o.id, label: o.name };
                    } catch (err) { toast(getApiError(err, 'Could not add'), 'error'); return null; }
                  }} /></div>
            ) : (
              <div><label style={LABEL}>Project</label>
                <SearchableDropdown options={projectOpts} value={project} allowClear placeholder="Which project"
                  onChange={v => setProject(v ? Number(v) : null)} /></div>
            )}
            <div><label style={LABEL}>Cost Code</label>
              {selectedType ? (
                <SearchableDropdown options={costCodeOpts} value={costCode} allowClear
                  placeholder={isIndirect ? 'Office / overhead code' : 'Project expense code'}
                  onChange={v => {
                    const id = v ? Number(v) : null;
                    setCostCode(id);
                    const cc = allCostCodes.find((c: any) => c.id === id);
                    if (!cc?.is_vehicle_effective) setVehicle(null);   // not a vehicle code → drop any vehicle
                  }} />
              ) : (
                <div style={{ ...INPUT, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', cursor: 'not-allowed' }}>
                  Choose a Cost Type first
                </div>
              )}
            </div>
            <div><label style={LABEL}>Supplier {vatLiable && <span style={{ color: 'var(--status-error)' }}>*</span>}</label>
              <SearchableDropdown options={supplierOpts} value={supplier} allowClear placeholder="Select or add supplier"
                onChange={v => { const id = v ? Number(v) : null; setSupplier(id); if (id) setPayee(''); }}
                onCreateOption={async name => {
                  try {
                    const s: any = await suppliersApi.create({ name, business_name: name } as any);
                    queryClient.invalidateQueries({ queryKey: ['suppliers-active'] });
                    return { value: s.id, label: s.business_name || s.name };
                  } catch (err) { toast(getApiError(err, 'Could not add supplier'), 'error'); return null; }
                }} /></div>
            {showVehicle && (
              <div><label style={LABEL}>Vehicle</label>
                <SearchableDropdown options={vehicleOpts} value={vehicle} allowClear
                  placeholder={vehicles.length ? 'Select a vehicle' : 'No vehicles registered'}
                  onChange={v => { const id = v ? Number(v) : null; setVehicle(id); if (id) setPayee(''); }} />
                {vehicles.length === 0 && (
                  <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text-muted)' }}>
                    Register vehicles in HR → Assets to pick them here.
                  </div>
                )}
              </div>
            )}
            {!supplier && !vehicle && (
              <div><label style={LABEL}>Payee</label>
                <input style={INPUT} value={payee} onChange={e => setPayee(e.target.value)} placeholder="Who was paid (no supplier / vehicle)" /></div>
            )}
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
              <div style={{ minWidth: 130 }}><label style={LABEL}>VAT (AED) · 5%</label>
                <div style={{ ...INPUT, background: 'var(--bg-secondary)' }} className="font-mono">{formatPrice(vatAmount)}</div></div>
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
