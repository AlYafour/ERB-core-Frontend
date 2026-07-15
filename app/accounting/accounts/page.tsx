'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountingApi, type GLAccount, type AccountNature } from '@/lib/api/accounting';
import { toast, confirm } from '@/lib/hooks/use-toast';
const toastOk = (m: string) => toast(m, 'success');
const toastErr = (m: string) => toast(m, 'error');
const toastInfo = (m: string) => toast(m, 'info');
import { getApiError } from '@/lib/utils/error';
import { Button, Badge, type Column } from '@/components/ui';
import { RowActions } from '@/components/ui/RowActions';
import { AppListPage } from '@/components/app/AppListPage';
import { BaseModal } from '@/components/ui/base/BaseModal';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useTableState } from '@/lib/hooks/use-table-state';

const fmt = (v: string | number) =>
  `AED ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const NATURES: { value: AccountNature; label: string }[] = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'cogs', label: 'Cost of Sales' },
  { value: 'expense', label: 'Expense' },
  { value: 'other_income', label: 'Other Income' },
  { value: 'other_expense', label: 'Other Expense' },
];

const DEBIT_NATURES = new Set(['asset', 'cogs', 'expense', 'other_expense']);

const INPUT: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
  color: 'var(--text-primary)', fontSize: 'var(--text-sm)',
};
const LABEL: React.CSSProperties = {
  fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'block', marginBottom: 4,
};

type FormState = {
  id?: number;
  code: string; name: string; name_ar: string; description: string;
  category: number | ''; parent: number | ''; is_postable: boolean; is_active: boolean;
  is_system?: boolean;
};

const EMPTY: FormState = {
  code: '', name: '', name_ar: '', description: '',
  category: '', parent: '', is_postable: true, is_active: true,
};

export default function ChartOfAccountsPage() {
  const queryClient = useQueryClient();
  const tableState = useTableState();
  const [modal, setModal] = useState<FormState | null>(null);

  const { data: categoriesData } = useQuery({
    queryKey: ['acc-categories'],
    queryFn: () => accountingApi.listCategories(),
  });
  const categories = categoriesData?.results ?? [];

  const { data, isLoading, error } = useQuery({
    queryKey: ['acc-accounts', tableState.page, tableState.search, tableState.filters],
    queryFn: () => accountingApi.listAccounts({
      page: tableState.page, search: tableState.search || undefined,
      page_size: 50, ...tableState.filters,
    }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['acc-accounts'] });

  const save = useMutation({
    mutationFn: (form: FormState) => {
      const payload = {
        code: form.code, name: form.name, name_ar: form.name_ar,
        description: form.description,
        category: Number(form.category),
        parent: form.parent ? Number(form.parent) : null,
        is_postable: form.is_postable, is_active: form.is_active,
      };
      return form.id
        ? accountingApi.updateAccount(form.id, payload)
        : accountingApi.createAccount(payload);
    },
    onSuccess: () => { toastOk('Account saved.'); setModal(null); invalidate(); },
    onError: (e) => toastErr(getApiError(e)),
  });

  const remove = useMutation({
    mutationFn: (id: number) => accountingApi.deleteAccount(id),
    onSuccess: () => { toastOk('Account deleted.'); invalidate(); },
    onError: (e) => toastErr(getApiError(e)),
  });

  const showBalance = async (account: GLAccount) => {
    try {
      const res = await accountingApi.accountBalance(account.id);
      toastInfo(`${account.code} — ${account.name}: ${fmt(res.balance)} (${res.normal_side}-normal)`);
    } catch (e) {
      toastErr(getApiError(e));
    }
  };

  const filterFields: FilterField[] = useMemo(() => [
    {
      name: 'category', label: 'Category', type: 'select', group: 'Filters',
      options: categories.map((c) => ({ value: String(c.id), label: `${c.code} ${c.name}` })),
    },
    {
      name: 'nature', label: 'Nature', type: 'select', group: 'Filters',
      options: NATURES.map((n) => ({ value: n.value, label: n.label })),
    },
    {
      name: 'is_active', label: 'Active', type: 'select', group: 'Filters',
      options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }],
    },
  ], [categories]);

  const columns: Column<GLAccount>[] = [
    { key: 'code', header: 'Code', render: (a) => <span style={{ fontWeight: 600 }}>{a.code}</span> },
    {
      key: 'name', header: 'Name',
      render: (a) => (
        <div>
          <div>{a.name}</div>
          {a.name_ar ? <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{a.name_ar}</div> : null}
        </div>
      ),
    },
    { key: 'category_name', header: 'Category', render: (a) => a.category_name ?? '—' },
    {
      key: 'nature', header: 'Nature',
      render: (a) => (
        <Badge variant={DEBIT_NATURES.has(a.nature) ? 'info' : 'success'}>
          {NATURES.find((n) => n.value === a.nature)?.label ?? a.nature}
        </Badge>
      ),
    },
    { key: 'is_postable', header: 'Postable', render: (a) => (a.is_postable ? 'Yes' : 'Header') },
    {
      key: 'is_active', header: 'Status',
      render: (a) => <Badge variant={a.is_active ? 'success' : 'default'}>{a.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions', header: '',
      render: (a) => (
        <RowActions
          actions={[
            { label: 'Balance', onClick: () => showBalance(a) },
            {
              label: 'Edit',
              onClick: () => setModal({
                id: a.id, code: a.code, name: a.name, name_ar: a.name_ar,
                description: a.description, category: a.category,
                parent: a.parent ?? '', is_postable: a.is_postable,
                is_active: a.is_active, is_system: a.is_system,
              }),
            },
            ...(!a.is_system ? [{
              label: 'Delete', variant: 'danger' as const,
              onClick: async () => {
                if (await confirm(`Delete account ${a.code} — ${a.name}? Accounts with history cannot be deleted.`)) {
                  remove.mutate(a.id);
                }
              },
            }] : []),
          ]}
        />
      ),
    },
  ];

  const results = data?.results ?? [];
  const modalCategory = categories.find((c) => c.id === Number(modal?.category));
  const parentOptions = results.filter(
    (a) => a.category === Number(modal?.category) && a.id !== modal?.id,
  );

  return (
    <>
      <AppListPage
        title="Chart of Accounts"
        description="Your account structure — names, codes and grouping are fully yours; the accounting math stays locked."
        breadcrumbs={[{ label: 'Accounting', href: '/accounting' }, { label: 'Chart of Accounts' }]}
        totalCount={data?.count ?? 0}
        createAction={<Button onClick={() => setModal(EMPTY)}>+ New Account</Button>}
        filterFields={filterFields}
        columns={columns}
        data={results}
        isLoading={isLoading}
        error={error}
        tableState={tableState}
      />

      {modal ? (
        <BaseModal isOpen onClose={() => setModal(null)} title={modal.id ? `Edit ${modal.code}` : 'New Account'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {modal.is_system ? (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--warning, #b45309)' }}>
                System account: rename freely — re-classification and deletion are blocked.
              </div>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
              <div>
                <label style={LABEL}>Code</label>
                <input style={INPUT} value={modal.code} onChange={(e) => setModal({ ...modal, code: e.target.value })} />
              </div>
              <div>
                <label style={LABEL}>Name</label>
                <input style={INPUT} value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} />
              </div>
            </div>
            <div>
              <label style={LABEL}>Arabic name</label>
              <input style={INPUT} dir="rtl" value={modal.name_ar} onChange={(e) => setModal({ ...modal, name_ar: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={LABEL}>Category {modalCategory ? `(${modalCategory.nature})` : ''}</label>
                <select
                  style={INPUT} value={modal.category} disabled={!!modal.is_system}
                  onChange={(e) => setModal({ ...modal, category: Number(e.target.value), parent: '' })}
                >
                  <option value="">Select…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={LABEL}>Parent (optional)</label>
                <select style={INPUT} value={modal.parent}
                        onChange={(e) => setModal({ ...modal, parent: e.target.value ? Number(e.target.value) : '' })}>
                  <option value="">None</option>
                  {parentOptions.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label style={LABEL}>Description</label>
              <textarea style={{ ...INPUT, minHeight: 60 }} value={modal.description}
                        onChange={(e) => setModal({ ...modal, description: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 18 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)' }}>
                <input type="checkbox" checked={modal.is_postable}
                       onChange={(e) => setModal({ ...modal, is_postable: e.target.checked })} />
                Postable (uncheck for header/group accounts)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)' }}>
                <input type="checkbox" checked={modal.is_active}
                       onChange={(e) => setModal({ ...modal, is_active: e.target.checked })} />
                Active
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!modal.code || !modal.name || !modal.category) {
                    toastErr('Code, name and category are required.');
                    return;
                  }
                  save.mutate(modal);
                }}
                disabled={save.isPending}
              >
                {save.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </BaseModal>
      ) : null}
    </>
  );
}
