'use client';

/**
 * ExpenseForm — fast multi-line petty-cash entry. Date + Cash Box are shared
 * across the batch; each expense is a two-row card (coding on row 1, party +
 * money on row 2) with a numbered badge. Cost coding cascades Main Category →
 * Sub Category → Cost Code exactly as deep as the tenant's real cost-code
 * tree goes on that branch — some branches genuinely have all three tiers
 * (the direct-cost catalog), others bottom out after two (the indirect/
 * office catalog); nothing here hardcodes which. Project (direct) or
 * Office/Location (indirect) sits beside it. Every list is add-able inline
 * (codes are generated server-side). VAT is auto-extracted (5%, gross is
 * VAT-inclusive).
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, Button, PageHeader } from '@/components/ui';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { expensesApi, type Expense } from '@/lib/api/expenses';
import { costCodesApi } from '@/lib/api/cost-codes';
import { projectsApi } from '@/lib/api/projects';
import { suppliersApi } from '@/lib/api/suppliers';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { formatPrice } from '@/lib/utils/format';
import type { CostCode } from '@/types';

const today = () => new Date().toISOString().slice(0, 10);
const LABEL: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' };
const INPUT: React.CSSProperties = {
  width: '100%', height: 38, padding: '8px 10px', fontSize: 'var(--text-sm)',
  border: '1.5px solid var(--border-default)', borderRadius: 8,
  background: 'var(--surface-primary)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none',
};
const READONLY: React.CSSProperties = { ...INPUT, background: 'var(--surface-subtle)', display: 'flex', alignItems: 'center', fontFamily: 'monospace', fontWeight: 600 };
const DISABLED: React.CSSProperties = { ...INPUT, color: 'var(--text-muted)', background: 'var(--surface-subtle)', display: 'flex', alignItems: 'center', cursor: 'not-allowed', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden' };

/** Squash whitespace; the pickers render multiline so bilingual labels
 *  (English + Arabic) show in full instead of losing their tail. */
const clean = (s: string | null | undefined, n = 160) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const codeOption = (c: CostCode) => ({
  value: c.id,
  label: `${c.excel_code} — ${clean(c.description)}`,
  searchText: `${c.excel_code} ${c.qb_code} ${c.description}`,
});

interface Line {
  key: number;
  serial: string;
  costType: string | null;
  workSection: number | null;  // top-level branch (Direct's real Level 1: "EXCAVATION & CONCRETE WORKS"…)
  category: number | null;     // Main Category, one level down — only exists on branches that actually have one
  costCode: number | null;     // the actual posted code (leaf, wherever the branch bottoms out)
  project: number | null;
  overhead: string | null;
  supplier: number | null;
  vehicle: number | null;
  payee: string;               // legacy free-text mirror (kept for edit prefill)
  payeeWorker: string | null;  // structured payee: one of the box's workers
  invoiceNo: string;
  invoiceDate: string;
  description: string;
  amount: string;
  vatLiable: boolean;
  files: File[];
}

const blankLine = (key: number): Line => ({
  key, serial: '', costType: null, workSection: null, category: null, costCode: null,
  project: null, overhead: null, supplier: null, vehicle: null, payee: '', payeeWorker: null,
  invoiceNo: '', invoiceDate: '', description: '', amount: '', vatLiable: false, files: [],
});

const lineFromExisting = (e: Expense): Line => ({
  key: 1, serial: e.voucher_number || '', costType: e.cost_type,
  workSection: null, category: null /* derived from the saved code once the tree loads */,
  costCode: e.cost_code, project: e.project,
  overhead: (e as any).overhead_category ?? null,
  supplier: e.supplier, vehicle: e.vehicle ?? null, payee: e.payee_name || '',
  payeeWorker: e.payee_worker ?? null,
  invoiceNo: e.invoice_no || '', invoiceDate: e.invoice_date || '',
  description: e.description || '',
  amount: String(e.amount), vatLiable: e.vat_liable, files: [],
});

const lineVat = (ln: Line) => ln.vatLiable ? Math.round((parseFloat(ln.amount) || 0) * 5 / 105 * 100) / 100 : 0;
const lineNet = (ln: Line) => (parseFloat(ln.amount) || 0) - lineVat(ln);

export default function ExpenseForm({ existing }: { existing?: Expense }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = !!existing;
  const { user } = useAuth();
  const { isTenantAdmin } = useMyPermissions();

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

  const allCostCodes: CostCode[] = Array.isArray(ccData) ? ccData : ((ccData as any)?.results ?? []);
  const projects = (projData as any)?.results ?? [];

  // The signed-in custodian's own box: auto-selected, and locked for
  // non-admins — a custodian never files vouchers against someone else's box.
  const myBox = useMemo(
    () => boxes.find(b => b.kind === 'petty_cash' && b.custodian === user?.id) ?? null,
    [boxes, user?.id]);
  useEffect(() => {
    if (!isEdit && myBox) setCashBox(prev => prev ?? myBox.id);
  }, [isEdit, myBox]);
  const boxLocked = !isEdit && !!myBox && !isTenantAdmin;

  // The selected box's workers — the people the custodian hands cash to;
  // they populate the Payee picker and each shows a live float balance.
  const { data: workers = [] } = useQuery({
    queryKey: ['box-workers', cashBox],
    queryFn: () => expensesApi.listBoxWorkers(cashBox!),
    enabled: !!cashBox, staleTime: 60_000,
  });

  const boxOpts = boxes.map(b => ({ value: b.id, label: `${b.name}${b.custodian_name ? ` — ${b.custodian_name}` : ''}${b.kind === 'petty_cash' ? '' : ' (Bank)'}` }));
  const costTypeOpts = costTypes.map(c => ({ value: c.id, label: c.name }));
  const projectOpts = projects.map((p: any) => ({ value: p.id, label: p.code ? `${p.code} — ${p.name}` : p.name }));
  const supplierOpts = supData.map((s: any) => ({ value: s.id, label: s.business_name || s.name }));
  const vehicleOpts = vehicles.map(v => ({ value: v.id, label: v.label }));

  /** Data-driven hierarchy for one cost type (direct/indirect) — depth isn't
   *  assumed: some branches genuinely cascade Work Section → Main Category →
   *  Cost Code (3 levels, real Direct data), others go straight from their
   *  top-level branch to postable items (2 levels, real Indirect data). The
   *  form below reads this shape directly instead of hardcoding either. */
  const treeFor = (isDirect: boolean) => {
    const matching = allCostCodes.filter(c => (c.is_direct ?? true) === isDirect);
    const kids = new Map<number, CostCode[]>();
    for (const c of matching) {
      if (c.parent != null) {
        if (!kids.has(c.parent)) kids.set(c.parent, []);
        kids.get(c.parent)!.push(c);
      }
    }
    const isLeaf = (c: CostCode) => !kids.has(c.id);
    // A true top-level branch is level 1 AND parentless — level is checked
    // too, not just parent==null: a code the catalog couldn't safely
    // reparent (an unresolved source-file ambiguity) is still a deep item,
    // not a new branch, even while it's sitting parentless.
    const roots = matching.filter(c => c.parent == null && c.level === 1);
    // Every postable code (used for search-across-everything when nothing picked yet).
    const leaves = matching.filter(c => isLeaf(c) && c.level !== 1);
    return { matching, kids, isLeaf, roots, leaves };
  };

  /** Walk a leaf code's parent chain back to its root — used to pre-fill the
   *  Work Section / Main Category pickers when opening an existing voucher,
   *  or when a code is picked directly in the free-search Cost Code box. */
  const ancestorChain = (code: CostCode | null): CostCode[] => {
    const chain: CostCode[] = [];
    let node = code;
    const seen = new Set<number>();
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      chain.unshift(node);
      node = node.parent != null ? (allCostCodes.find(c => c.id === node!.parent) ?? null) : null;
    }
    return chain; // [root, …, leaf]
  };

  const updateLine = (key: number, patch: Partial<Line>) =>
    setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => setLines(ls => [...ls, blankLine(Math.max(0, ...ls.map(l => l.key)) + 1)]);
  const removeLine = (key: number) => setLines(ls => (ls.length > 1 ? ls.filter(l => l.key !== key) : ls));

  const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const vatTotal = lines.reduce((s, l) => s + lineVat(l), 0);
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
      payee_worker: ln.payeeWorker,
      payee_name: ln.payeeWorker ? '' : ln.payee,   // server mirrors the worker's name
      invoice_no: ln.invoiceNo,
      invoice_date: ln.invoiceDate || null,
      description: ln.description,
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
  const mkCostCode = async (name: string, isDirect: boolean, parent?: number | null, asRoot?: boolean) => {
    try {
      const c = await costCodesApi.quickAdd({
        name, is_direct: isDirect, parent: parent ?? undefined,
        ...(asRoot ? { level: '1' as const } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ['cost-codes-all'] });
      return codeOption(c);
    } catch (err) { toast(getApiError(err, 'Could not add the code'), 'error'); return null; }
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
        <div className="card" style={{ marginBottom: 'var(--space-4)', padding: '14px 18px' }}>
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 190px' }}>
              <label style={LABEL}>Date <span style={{ color: 'var(--status-error)' }}>*</span></label>
              <input type="date" style={INPUT} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 300px', minWidth: 260, maxWidth: 460 }}>
              <label style={LABEL}>Cash Box</label>
              {boxLocked ? (
                <div style={{ ...READONLY, fontFamily: 'inherit', gap: 8 }}>
                  <span style={{ fontWeight: 700 }}>{myBox!.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>— your box</span>
                </div>
              ) : (
                <SearchableDropdown options={boxOpts} value={cashBox} allowClear placeholder="Select or add a box"
                  onChange={v => setCashBox(v ? String(v) : null)}
                  onCreateOption={async name => {
                    try { const b = await expensesApi.createCashBox({ name });
                      queryClient.invalidateQueries({ queryKey: ['exp-cash-boxes'] });
                      return { value: b.id, label: b.name }; }
                    catch (err) { toast(getApiError(err, 'Could not add box'), 'error'); return null; }
                  }} />
              )}
            </div>
            {selectedBox && (
              <div style={{ flex: '0 0 auto', alignSelf: 'flex-end', paddingBottom: 8, fontSize: 12, fontWeight: 700, color: overSpend ? 'var(--status-error)' : 'var(--text-muted)' }}>
                Balance: <span style={{ fontFamily: 'monospace', fontSize: 14 }}>{formatPrice(boxBalance!)}</span>{overSpend && ' — total exceeds balance'}
              </div>
            )}
          </div>
        </div>

        {/* Expense lines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {lines.map((ln, i) => {
            const st = costTypes.find(c => c.id === ln.costType);
            const indirect = st ? !st.is_direct : false;
            const tree = st ? treeFor(st.is_direct) : null;

            const selCode = allCostCodes.find(c => c.id === ln.costCode) ?? null;
            const chain = tree ? ancestorChain(selCode) : [];  // [Work Section, (Main Category), leaf]

            // Work Section (Level 1 branch): explicit choice, else derived
            // from the saved leaf's ancestor chain (edit mode / free search).
            const wsId = ln.workSection ?? (chain.length >= 1 ? chain[0].id : null);
            const wsChildren = wsId != null ? (tree?.kids.get(wsId) ?? []) : [];
            // This branch has a real Main Category tier only when its
            // children are themselves groups (Direct's shape) — a branch
            // whose children are already postable items has none (Indirect's
            // shape), so the Main Category picker is skipped entirely.
            const needsCategory = wsChildren.length > 0 && wsChildren.every(c => !tree!.isLeaf(c));

            const catId = needsCategory ? (ln.category ?? (chain.length >= 3 ? chain[1].id : null)) : null;
            const catChildren = needsCategory && catId != null ? (tree?.kids.get(catId) ?? []) : [];

            const workSectionOpts = (tree?.roots ?? []).map(codeOption);
            const categoryOpts = wsChildren.map(codeOption);
            // Final Cost Code picker: children of whichever tier is the
            // immediate parent for this branch (Main Category if it has one,
            // else the Work Section directly) — or search everything when
            // no branch is picked yet.
            const codeOpts = wsId == null
              ? (tree?.leaves ?? []).map(codeOption)
              : needsCategory
                ? (catId != null ? catChildren.map(codeOption) : [])
                : wsChildren.map(codeOption);

            const showVehicle = !!(selCode?.is_vehicle_effective
              || allCostCodes.find(c => c.id === wsId)?.is_vehicle_effective
              || allCostCodes.find(c => c.id === catId)?.is_vehicle_effective);
            const vat = lineVat(ln);
            const net = lineNet(ln);
            const F = (grow: number, min: number): React.CSSProperties => ({ flex: `${grow} 1 ${min}px`, minWidth: min });

            return (
              <div key={ln.key} className="card" style={{ padding: '14px 18px', position: 'relative' }}>
                {!isEdit && lines.length > 1 && (
                  <button onClick={() => removeLine(ln.key)} title="Remove line"
                    style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, background: 'none', border: 'none', borderRadius: '50%', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1, zIndex: 1 }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--status-error)'; e.currentTarget.style.background = 'var(--surface-subtle)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}>✕</button>
                )}

                {/* Row 1 — coding: type → category → code → project/office (+vehicle) */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10, paddingRight: isEdit ? 0 : 26 }}>
                  <span style={{ alignSelf: 'flex-end', width: 26, height: 26, marginBottom: 6, borderRadius: '50%', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: '0 0 120px' }}>
                    <label style={LABEL}>Serial</label>
                    <input style={{ ...INPUT, fontFamily: 'monospace', fontWeight: 700 }}
                      value={ln.serial} onChange={e => updateLine(ln.key, { serial: e.target.value })} placeholder="01-GHP" />
                  </div>
                  <div style={F(1, 150)}>
                    <label style={LABEL}>Cost Type</label>
                    <SearchableDropdown options={costTypeOpts} value={ln.costType} allowClear placeholder="Direct / Indirect…"
                      onChange={v => { const id = v ? String(v) : null; const t = costTypes.find(c => c.id === id);
                        updateLine(ln.key, { costType: id, workSection: null, category: null, costCode: null, vehicle: null, ...(t && !t.is_direct ? { project: null } : { overhead: null }) }); }}
                      onCreateOption={async name => {
                        try { const c = await expensesApi.createCostType(name);
                          queryClient.invalidateQueries({ queryKey: ['exp-cost-types', isEdit] });
                          return { value: c.id, label: c.name }; }
                        catch (err) { toast(getApiError(err, 'Could not add type'), 'error'); return null; }
                      }} />
                  </div>
                  <div style={F(1.2, 180)}>
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
                  <div style={F(1.2, 180)}>
                    <label style={LABEL}>Main Category</label>
                    {st ? (
                      <SearchableDropdown options={workSectionOpts} value={wsId} allowClear multiline placeholder="Top-level branch"
                        onChange={v => {
                          const id = v ? Number(v) : null;
                          // Changing the branch invalidates everything under it.
                          const children = id != null ? (tree?.kids.get(id) ?? []) : [];
                          updateLine(ln.key, {
                            workSection: id, category: null, vehicle: null,
                            // A branch with no children at all posts to itself
                            // (rare — most have either a Sub Category tier or
                            // direct items below them, resolved by the next picker).
                            costCode: id != null && children.length === 0 ? id : null,
                          });
                        }}
                        onCreateOption={name => mkCostCode(name, st.is_direct, null, true)} />
                    ) : <div style={DISABLED}>Choose a Cost Type first</div>}
                  </div>
                  {needsCategory && (
                    <div style={F(1.2, 180)}>
                      <label style={LABEL}>Sub Category</label>
                      <SearchableDropdown options={categoryOpts} value={catId} allowClear multiline placeholder="Sub-classification"
                        onChange={v => {
                          const id = v ? Number(v) : null;
                          updateLine(ln.key, { category: id, costCode: null, vehicle: null });
                        }}
                        onCreateOption={name => mkCostCode(name, st!.is_direct, wsId)} />
                    </div>
                  )}
                  <div style={F(1.6, 220)}>
                    <label style={LABEL}>Cost Code</label>
                    {st ? (
                      <SearchableDropdown options={codeOpts} value={ln.costCode} allowClear multiline
                        placeholder={wsId == null ? 'Search all codes…' : needsCategory && catId == null ? 'Pick Sub Category first' : 'Select the item'}
                        onChange={v => {
                          const id = v ? Number(v) : null;
                          const cc = allCostCodes.find(c => c.id === id);
                          const patch: Partial<Line> = { costCode: id };
                          // Picking a code with no branch selected yet
                          // (free-search mode) auto-fills the whole chain above it.
                          if (id != null && wsId == null && cc) {
                            const anc = ancestorChain(cc);
                            if (anc.length >= 1) patch.workSection = anc[0].id;
                            if (anc.length >= 3) patch.category = anc[1].id;
                          }
                          if (!cc?.is_vehicle_effective) patch.vehicle = null;
                          updateLine(ln.key, patch);
                        }}
                        onCreateOption={name => {
                          const parentId = needsCategory ? catId : wsId;
                          if (parentId == null) {
                            toast(needsCategory ? 'Pick a Sub Category first, then add the item under it'
                                                : 'Pick a Main Category first, then add the item under it', 'error');
                            return Promise.resolve(null);
                          }
                          return mkCostCode(name, st!.is_direct, parentId);
                        }} />
                    ) : <div style={DISABLED}>Choose a Cost Type first</div>}
                  </div>
                  {showVehicle && (
                    <div style={F(1, 160)}>
                      <label style={LABEL}>Vehicle</label>
                      <SearchableDropdown options={vehicleOpts} value={ln.vehicle} allowClear
                        placeholder={vehicles.length ? 'Select a vehicle' : 'No vehicles'}
                        onChange={v => { const id = v ? Number(v) : null; updateLine(ln.key, { vehicle: id, ...(id ? { payee: '' } : {}) }); }} />
                    </div>
                  )}
                </div>

                {/* Row 2 — party + money */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <span style={{ width: 26, flexShrink: 0 }} />
                  <div style={F(1.1, 170)}>
                    <label style={LABEL}>Supplier {ln.vatLiable && <span style={{ color: 'var(--status-error)' }}>*</span>}</label>
                    <SearchableDropdown options={supplierOpts} value={ln.supplier} allowClear placeholder="Select or add"
                      onChange={v => { const id = v ? Number(v) : null; updateLine(ln.key, { supplier: id, ...(id ? { payee: '' } : {}) }); }}
                      onCreateOption={async name => { const r = await mkSupplier(name); return r; }} />
                  </div>
                  {!ln.supplier && !ln.vehicle && (
                    <div style={F(1, 170)}>
                      <label style={LABEL}>Payee</label>
                      {cashBox ? (
                        <SearchableDropdown
                          options={workers.map(w => ({
                            value: w.id,
                            label: `${w.name}  ·  ${Number(w.balance) < 0 ? '−' : ''}${Math.abs(Number(w.balance)).toFixed(2)}`,
                            searchText: w.name,
                          }))}
                          value={ln.payeeWorker} allowClear
                          placeholder={workers.length ? 'Who took the cash' : 'Add your people…'}
                          onChange={v => updateLine(ln.key, { payeeWorker: v ? String(v) : null })}
                          onCreateOption={async name => {
                            try {
                              const w = await expensesApi.createBoxWorker(cashBox, { name });
                              queryClient.invalidateQueries({ queryKey: ['box-workers', cashBox] });
                              return { value: w.id, label: w.name };
                            } catch (err) { toast(getApiError(err, 'Could not add person'), 'error'); return null; }
                          }} />
                      ) : (
                        <div style={DISABLED}>Choose a Cash Box first</div>
                      )}
                    </div>
                  )}
                  <div style={{ flex: '0 0 110px' }}>
                    <label style={LABEL}>Invoice No.</label>
                    <input style={INPUT} value={ln.invoiceNo} onChange={e => updateLine(ln.key, { invoiceNo: e.target.value })} />
                  </div>
                  <div style={{ flex: '0 0 140px' }}>
                    <label style={LABEL}>Invoice Date</label>
                    <input type="date" style={INPUT} value={ln.invoiceDate}
                      onChange={e => updateLine(ln.key, { invoiceDate: e.target.value })} />
                  </div>
                  <div style={F(1.8, 200)}>
                    <label style={LABEL}>Description</label>
                    <input style={INPUT} value={ln.description} onChange={e => updateLine(ln.key, { description: e.target.value })} placeholder="What was this for?" />
                  </div>
                  <div style={{ flex: '0 0 115px' }}>
                    <label style={LABEL}>Gross (AED) <span style={{ color: 'var(--status-error)' }}>*</span></label>
                    <input type="number" min="0" step="0.01" placeholder="0.00" style={{ ...INPUT, fontFamily: 'monospace', fontWeight: 700, textAlign: 'right' }}
                      value={ln.amount} onChange={e => updateLine(ln.key, { amount: e.target.value })} />
                  </div>
                  <button type="button" onClick={() => updateLine(ln.key, { vatLiable: !ln.vatLiable })}
                    title="Gross includes 5% VAT — needs a supplier tax invoice"
                    style={{
                      height: 38, padding: '0 12px', flexShrink: 0, borderRadius: 8, cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
                      border: `1.5px solid ${ln.vatLiable ? 'var(--brand)' : 'var(--border-default)'}`,
                      background: ln.vatLiable ? 'var(--brand)' : 'transparent',
                      color: ln.vatLiable ? '#fff' : 'var(--text-muted)',
                    }}>
                    VAT 5%{ln.vatLiable ? ` · ${vat.toFixed(2)}` : ''}
                  </button>
                  <div style={{ flex: '0 0 105px' }}>
                    <label style={LABEL}>Net</label>
                    <div style={{ ...READONLY, justifyContent: 'flex-end' }}>{(parseFloat(ln.amount) ? net : 0).toFixed(2)}</div>
                  </div>
                  <label title="Attach receipts" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, height: 38, minWidth: 44, padding: '0 10px', cursor: 'pointer', border: '1.5px dashed var(--border-default)', borderRadius: 8, color: 'var(--brand)', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                    📎{ln.files.length ? ` ${ln.files.length}` : ''}
                    <input type="file" multiple hidden onChange={e => {
                      const chosen = Array.from(e.target.files ?? []).filter(f => f.size <= 20 * 1024 * 1024);
                      if (chosen.length < (e.target.files?.length ?? 0)) toast('Some files exceed 20 MB and were skipped', 'error');
                      updateLine(ln.key, { files: [...ln.files, ...chosen] }); e.target.value = '';
                    }} />
                  </label>
                </div>
                {ln.files.length > 0 && (
                  <div style={{ marginTop: 6, marginLeft: 36, fontSize: 11, color: 'var(--text-muted)' }}>
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
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
            {vatTotal > 0 && (
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                incl. VAT <span style={{ fontFamily: 'monospace' }}>{vatTotal.toFixed(2)}</span>
              </span>
            )}
            <span>Total: <span style={{ fontFamily: 'monospace', color: overSpend ? 'var(--status-error)' : 'var(--brand)' }}>{formatPrice(total)}</span></span>
          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
}
