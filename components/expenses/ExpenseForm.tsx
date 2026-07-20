'use client';

/**
 * ExpenseForm — fast multi-line petty-cash entry. Date + Cash Box are shared
 * across the batch; each expense is a two-row card (coding on row 1, party +
 * money on row 2) with a bold serial. "+ Add another line" appends a card and
 * one Save posts them all. Editing an existing voucher shows a single card.
 * VAT is auto-extracted (5%, gross is VAT-inclusive). No hardcoded lookups —
 * cost types / offices / suppliers / cash boxes are all add-able inline.
 */

import { useState } from 'react';
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
const LABEL: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' };
const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 'var(--text-sm)',
  border: '1.5px solid var(--border-default)', borderRadius: 8,
  background: 'var(--surface-primary)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none',
};
const READONLY: React.CSSProperties = { ...INPUT, background: 'var(--surface-subtle)', display: 'flex', alignItems: 'center', fontFamily: 'monospace' };

interface Line {
  key: number;
  serial: string;
  costType: string | null;
  project: number | null;
  overhead: string | null;
  costCode: number | null;
  supplier: number | null;
  vehicle: number | null;
  payee: string;
  invoiceNo: string;
  description: string;
  amount: string;
  vatLiable: boolean;
  files: File[];
}

const blankLine = (key: number): Line => ({
  key, serial: '', costType: null, project: null, overhead: null, costCode: null,
  supplier: null, vehicle: null, payee: '', invoiceNo: '', description: '',
  amount: '', vatLiable: false, files: [],
});

const lineFromExisting = (e: Expense): Line => ({
  key: 1, serial: e.voucher_number || '', costType: e.cost_type,
  project: e.project, overhead: (e as any).overhead_category ?? null, costCode: e.cost_code,
  supplier: e.supplier, vehicle: e.vehicle ?? null, payee: e.payee_name || '',
  invoiceNo: e.invoice_no || '', description: e.description || '',
  amount: String(e.amount), vatLiable: e.vat_liable, files: [],
});

const lineVat = (ln: Line) => ln.vatLiable ? Math.round((parseFloat(ln.amount) || 0) * 5 / 105 * 100) / 100 : 0;
const lineNet = (ln: Line) => (parseFloat(ln.amount) || 0) - lineVat(ln);

export default function ExpenseForm({ existing }: { existing?: Expense }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = !!existing;

  const [date, setDate] = useState(existing?.expense_date ?? today());
  const [cashBox, setCashBox] = useState<string | null>(existing?.cash_box ?? null);
  const [lines, setLines] = useState<Line[]>(existing ? [lineFromExisting(existing)] : [blankLine(1)]);

  const { data: boxes = [] }     = useQuery({ queryKey: ['exp-cash-boxes'], queryFn: () => expensesApi.listCashBoxes(), staleTime: 300_000 });
  const { data: costTypes = [] } = useQuery({ queryKey: ['exp-cost-types', isEdit], queryFn: () => expensesApi.listCostTypes(isEdit), staleTime: 300_000 });
  const { data: overheads = [] } = useQuery({ queryKey: ['exp-overheads', isEdit], queryFn: () => expensesApi.listOverheadCategories(isEdit), staleTime: 300_000 });
  const { data: ccData }         = useQuery({ queryKey: ['cost-codes-all'], queryFn: () => costCodesApi.getAll(), staleTime: 300_000 });
  const { data: projData }       = useQuery({ queryKey: ['projects-for-exp'], queryFn: () => projectsApi.getAll({ page_size: 300 } as any), staleTime: 300_000 });
  const { data: supData = [] }   = useQuery({ queryKey: ['suppliers-active'], queryFn: () => suppliersApi.getAllActive(), staleTime: 300_000 });
  const { data: vehicles = [] }  = useQuery({ queryKey: ['exp-vehicles'], queryFn: () => expensesApi.listVehicles(), staleTime: 300_000 });

  const allCostCodes = Array.isArray(ccData) ? ccData : ((ccData as any)?.results ?? []);
  const projects = (projData as any)?.results ?? [];

  const boxOpts = boxes.map(b => ({ value: b.id, label: `${b.name}${b.custodian_name ? ` — ${b.custodian_name}` : ''}${b.kind === 'petty_cash' ? '' : ' (Bank)'}` }));
  const costTypeOpts = costTypes.map(c => ({ value: c.id, label: c.name }));
  const projectOpts = projects.map((p: any) => ({ value: p.id, label: p.code ? `${p.code} — ${p.name}` : p.name }));
  const supplierOpts = supData.map((s: any) => ({ value: s.id, label: s.business_name || s.name }));
  const vehicleOpts = vehicles.map(v => ({ value: v.id, label: v.label }));

  const updateLine = (key: number, patch: Partial<Line>) =>
    setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => setLines(ls => [...ls, blankLine(Math.max(0, ...ls.map(l => l.key)) + 1)]);
  const removeLine = (key: number) => setLines(ls => (ls.length > 1 ? ls.filter(l => l.key !== key) : ls));

  const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const selectedBox = boxes.find(b => b.id === cashBox);
  const boxBalance = selectedBox ? Number(selectedBox.balance ?? 0) : null;
  const overSpend = boxBalance !== null && total > 0 && total > boxBalance;

  const buildPayload = (ln: Line) => {
    const st = costTypes.find(c => c.id === ln.costType);
    const indirect = st ? !st.is_direct : false;
    return {
      cash_box: cashBox, expense_date: date, voucher_number: ln.serial,
      cost_type: ln.costType,
      project: indirect ? null : ln.project,
      overhead_category: indirect ? ln.overhead : null,
      cost_code: ln.costCode, supplier: ln.supplier, vehicle: ln.vehicle,
      payee_name: ln.payee, invoice_no: ln.invoiceNo, description: ln.description,
      amount: ln.amount, vat_liable: ln.vatLiable,
      vat_amount: ln.vatLiable ? lineVat(ln).toFixed(2) : '0',
    };
  };

  const save = useMutation({
    mutationFn: async () => {
      const rows = lines.filter(l => (parseFloat(l.amount) || 0) > 0);
      if (isEdit) {
        const ln = rows[0] ?? lines[0];
        const saved = await expensesApi.update(existing!.id, buildPayload(ln) as any);
        for (const f of ln.files) { try { await expensesApi.uploadAttachment(saved.id, f); } catch { toast(`Receipt "${f.name}" failed`, 'error'); } }
        return [saved];
      }
      const out: Expense[] = [];
      for (const ln of rows) {
        const saved = await expensesApi.create(buildPayload(ln) as any);
        for (const f of ln.files) { try { await expensesApi.uploadAttachment(saved.id, f); } catch { toast(`Receipt "${f.name}" failed`, 'error'); } }
        out.push(saved);
      }
      return out;
    },
    onSuccess: (saved) => {
      toast(isEdit ? 'Expense updated' : `${saved.length} expense${saved.length === 1 ? '' : 's'} created`, 'success');
      router.push(isEdit ? `/expenses/${saved[0].id}` : '/expenses');
    },
    onError: (err) => toast(getApiError(err, 'Failed to save'), 'error'),
  });

  const handleSave = async () => {
    const rows = lines.filter(l => (parseFloat(l.amount) || 0) > 0);
    if (!rows.length) { toast('Add at least one line with an amount', 'error'); return; }
    for (const l of rows) {
      if (l.vatLiable && !l.supplier) { toast('A VAT-liable line needs a supplier (with TRN)', 'error'); return; }
    }
    if (overSpend && !(await confirm(
      `Total (${formatPrice(total)}) is more than the box balance (${formatPrice(boxBalance!)}). Record anyway?`))) return;
    save.mutate();
  };
  const handleCancel = async () => {
    if (!isEdit && (total > 0 || cashBox) && !(await confirm('Discard these expenses?'))) return;
    router.push('/expenses');
  };

  const mkSupplier = async (name: string) => {
    try { const s: any = await suppliersApi.create({ name, business_name: name } as any);
      queryClient.invalidateQueries({ queryKey: ['suppliers-active'] });
      return { value: s.id, label: s.business_name || s.name }; }
    catch (err) { toast(getApiError(err, 'Could not add supplier'), 'error'); return null; }
  };

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={isEdit ? `Edit ${existing!.voucher_number || existing!.number}` : 'New Expense'}
          description={isEdit ? 'Edit this petty-cash voucher.' : 'Add one or more petty-cash vouchers — same date & cash box, one line each.'}
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Petty Cash & Expenses', href: '/expenses' }, { label: isEdit ? 'Edit' : 'New' }]}
          backHref="/expenses"
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={save.isPending}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleSave} isLoading={save.isPending}>
                {isEdit ? 'Save changes' : `Save${lines.length > 1 ? ` (${lines.filter(l => (parseFloat(l.amount) || 0) > 0).length})` : ''}`}
              </Button>
            </div>
          }
        />

        {/* Shared header */}
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 200px' }}>
              <label style={LABEL}>Date <span style={{ color: 'var(--status-error)' }}>*</span></label>
              <input type="date" style={INPUT} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 280px', minWidth: 240 }}>
              <label style={LABEL}>Cash Box</label>
              <SearchableDropdown options={boxOpts} value={cashBox} allowClear placeholder="Select or add a box"
                onChange={v => setCashBox(v ? String(v) : null)}
                onCreateOption={async name => {
                  try { const b = await expensesApi.createCashBox({ name });
                    queryClient.invalidateQueries({ queryKey: ['exp-cash-boxes'] });
                    return { value: b.id, label: b.name }; }
                  catch (err) { toast(getApiError(err, 'Could not add box'), 'error'); return null; }
                }} />
              {selectedBox && (
                <div style={{ fontSize: 11, marginTop: 5, fontWeight: 600, color: overSpend ? 'var(--status-error)' : 'var(--text-muted)' }}>
                  Balance: <span style={{ fontFamily: 'monospace' }}>{formatPrice(boxBalance!)}</span>{overSpend && ' — total exceeds balance'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Expense lines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {lines.map((ln, i) => {
            const st = costTypes.find(c => c.id === ln.costType);
            const indirect = st ? !st.is_direct : false;
            const codes = st ? allCostCodes.filter((c: any) => (c.is_direct ?? true) === st.is_direct) : allCostCodes;
            const codeOpts = codes.filter((c: any) => c.level !== 1).map((c: any) => {
              const grp = c.parent_desc ? String(c.parent_desc).replace(/\s*[—-].*$/, '').trim().slice(0, 20) : '';
              return { value: c.id, label: `${c.excel_code} — ${String(c.description || '').replace(/\s*[—-].*$/, '').trim().slice(0, 30)}${grp ? `  ·  ${grp}` : ''}` };
            });
            const selCode = allCostCodes.find((c: any) => c.id === ln.costCode);
            const showVehicle = !!selCode?.is_vehicle_effective;
            const vat = lineVat(ln);
            const net = lineNet(ln);
            const fieldStyle = (basis: string): React.CSSProperties => ({ flex: `1 1 ${basis}`, minWidth: 0 });

            return (
              <div key={ln.key} className="card" style={{ padding: '16px 18px', position: 'relative' }}>
                {/* Line header: number + serial + remove */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'color-mix(in srgb, var(--brand) 14%, transparent)', color: 'var(--brand)', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: '0 0 200px' }}>
                    <label style={LABEL}>Serial / Voucher</label>
                    <input style={{ ...INPUT, fontFamily: 'monospace', fontWeight: 700, fontSize: 15, letterSpacing: '0.02em' }}
                      value={ln.serial} onChange={e => updateLine(ln.key, { serial: e.target.value })} placeholder="e.g. 01-GHP" />
                  </div>
                  <div style={{ flex: 1 }} />
                  {!isEdit && lines.length > 1 && (
                    <button onClick={() => removeLine(ln.key)} title="Remove line"
                      style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: 8, padding: 7, cursor: 'pointer', color: 'var(--status-error)', flexShrink: 0 }}>✕</button>
                  )}
                </div>

                {/* Row 1 — coding */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div style={fieldStyle('180px')}>
                    <label style={LABEL}>Cost Type</label>
                    <SearchableDropdown options={costTypeOpts} value={ln.costType} allowClear placeholder="Select or add"
                      onChange={v => { const id = v ? String(v) : null; const t = costTypes.find(c => c.id === id);
                        updateLine(ln.key, { costType: id, costCode: null, ...(t && !t.is_direct ? { project: null } : {}) }); }}
                      onCreateOption={async name => {
                        try { const c = await expensesApi.createCostType(name);
                          queryClient.invalidateQueries({ queryKey: ['exp-cost-types', isEdit] });
                          return { value: c.id, label: c.name }; }
                        catch (err) { toast(getApiError(err, 'Could not add type'), 'error'); return null; }
                      }} />
                  </div>
                  <div style={fieldStyle('230px')}>
                    <label style={LABEL}>Cost Code</label>
                    {st ? (
                      <SearchableDropdown options={codeOpts} value={ln.costCode} allowClear
                        placeholder={indirect ? 'Office / overhead code' : 'Project expense code'}
                        onChange={v => { const id = v ? Number(v) : null; const cc = allCostCodes.find((c: any) => c.id === id);
                          updateLine(ln.key, { costCode: id, ...(cc?.is_vehicle_effective ? {} : { vehicle: null }) }); }} />
                    ) : (
                      <div style={{ ...INPUT, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', cursor: 'not-allowed' }}>Choose a Cost Type first</div>
                    )}
                  </div>
                  <div style={fieldStyle('200px')}>
                    {indirect ? (
                      <>
                        <label style={LABEL}>Office / Location</label>
                        <SearchableDropdown options={overheads.map(o => ({ value: o.id, label: o.name }))} value={ln.overhead} allowClear placeholder="Select or add"
                          onChange={v => updateLine(ln.key, { overhead: v ? String(v) : null })}
                          onCreateOption={async name => {
                            try { const o = await expensesApi.createOverheadCategory(name);
                              queryClient.invalidateQueries({ queryKey: ['exp-overheads', isEdit] });
                              return { value: o.id, label: o.name }; }
                            catch (err) { toast(getApiError(err, 'Could not add'), 'error'); return null; }
                          }} />
                      </>
                    ) : (
                      <>
                        <label style={LABEL}>Project</label>
                        <SearchableDropdown options={projectOpts} value={ln.project} allowClear placeholder="Which project"
                          onChange={v => updateLine(ln.key, { project: v ? Number(v) : null })} />
                      </>
                    )}
                  </div>
                  {showVehicle && (
                    <div style={fieldStyle('190px')}>
                      <label style={LABEL}>Vehicle</label>
                      <SearchableDropdown options={vehicleOpts} value={ln.vehicle} allowClear
                        placeholder={vehicles.length ? 'Select a vehicle' : 'No vehicles'}
                        onChange={v => { const id = v ? Number(v) : null; updateLine(ln.key, { vehicle: id, ...(id ? { payee: '' } : {}) }); }} />
                    </div>
                  )}
                </div>

                {/* Row 2 — party + money */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={fieldStyle('190px')}>
                    <label style={LABEL}>Supplier {ln.vatLiable && <span style={{ color: 'var(--status-error)' }}>*</span>}</label>
                    <SearchableDropdown options={supplierOpts} value={ln.supplier} allowClear placeholder="Select or add"
                      onChange={v => { const id = v ? Number(v) : null; updateLine(ln.key, { supplier: id, ...(id ? { payee: '' } : {}) }); }}
                      onCreateOption={async name => { const r = await mkSupplier(name); return r; }} />
                  </div>
                  {!ln.supplier && !ln.vehicle && (
                    <div style={fieldStyle('150px')}>
                      <label style={LABEL}>Payee</label>
                      <input style={INPUT} value={ln.payee} onChange={e => updateLine(ln.key, { payee: e.target.value })} placeholder="Who was paid" />
                    </div>
                  )}
                  <div style={fieldStyle('120px')}>
                    <label style={LABEL}>Invoice No.</label>
                    <input style={INPUT} value={ln.invoiceNo} onChange={e => updateLine(ln.key, { invoiceNo: e.target.value })} />
                  </div>
                  <div style={fieldStyle('220px')}>
                    <label style={LABEL}>Description</label>
                    <input style={INPUT} value={ln.description} onChange={e => updateLine(ln.key, { description: e.target.value })} placeholder="What was this for?" />
                  </div>
                  <div style={{ flex: '0 0 110px' }}>
                    <label style={LABEL}>Gross (AED) <span style={{ color: 'var(--status-error)' }}>*</span></label>
                    <input type="number" min="0" step="0.01" style={INPUT} value={ln.amount} onChange={e => updateLine(ln.key, { amount: e.target.value })} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, flexShrink: 0, cursor: 'pointer' }}>
                    <input type="checkbox" checked={ln.vatLiable} onChange={e => updateLine(ln.key, { vatLiable: e.target.checked })} style={{ width: 15, height: 15 }} />
                    <span style={{ fontSize: 'var(--text-sm)' }}>VAT</span>
                  </label>
                  {ln.vatLiable && (
                    <div style={{ flex: '0 0 90px' }}>
                      <label style={LABEL}>VAT 5%</label>
                      <div style={READONLY}>{formatPrice(vat)}</div>
                    </div>
                  )}
                  <div style={{ flex: '0 0 100px' }}>
                    <label style={LABEL}>Net</label>
                    <div style={READONLY}>{formatPrice(net)}</div>
                  </div>
                  <label title="Attach receipts" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 36, padding: '0 10px', cursor: 'pointer', border: '1px dashed var(--border-default)', borderRadius: 8, color: 'var(--brand)', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                    📎 {ln.files.length || ''}
                    <input type="file" multiple hidden onChange={e => {
                      const chosen = Array.from(e.target.files ?? []).filter(f => f.size <= 20 * 1024 * 1024);
                      if (chosen.length < (e.target.files?.length ?? 0)) toast('Some files exceed 20 MB and were skipped', 'error');
                      updateLine(ln.key, { files: [...ln.files, ...chosen] }); e.target.value = '';
                    }} />
                  </label>
                </div>
                {ln.files.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                    {ln.files.map(f => f.name).join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add line + total */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 'var(--space-3)' }}>
          {!isEdit ? (
            <button onClick={addLine} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: '1.5px dashed var(--border-default)', background: 'transparent', color: 'var(--brand)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              ＋ Add another line
            </button>
          ) : <span />}
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Total: <span style={{ fontFamily: 'monospace', color: overSpend ? 'var(--status-error)' : 'var(--brand)' }}>{formatPrice(total)} AED</span>
          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
}
