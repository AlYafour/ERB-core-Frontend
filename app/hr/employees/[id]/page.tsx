'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrEmployeesApi, hrDepartmentsApi, hrPositionsApi, hrEmployeeGroupsApi, hrOfficeLocationsApi, hrLegalEntitiesApi } from '@/lib/api/hr';
import { usersApi } from '@/lib/api/users';
import PhoneInput from '@/components/ui/PhoneInput';
import HomeTab       from '@/components/users/HomeTab';
import AttendanceTab from '@/components/users/AttendanceTab';
import RequestsTab  from '@/components/users/RequestsTab';
import DocumentsTab from '@/components/users/DocumentsTab';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast } from '@/lib/hooks/use-toast';
import { Button, Badge, PageShell, Drawer, Loader } from '@/components/ui';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import DateInput from '@/components/ui/DateInput';
import { rolesApi, Role, UserRoles, AdditionalRoleAssignment } from '@/lib/api/roles';
import { HREmployee, User, EmployeeBankAccount } from '@/types';
import CustomFieldsSection from '@/components/shared/CustomFieldsSection';

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcAge(dob: string | null): string {
  if (!dob) return '—';
  const age = new Date().getFullYear() - new Date(dob).getFullYear();
  return `${age} Years Old`;
}

function calcPeriod(joinDate: string): string {
  const start = new Date(joinDate);
  const now   = new Date();
  let y = now.getFullYear() - start.getFullYear();
  let m = now.getMonth()    - start.getMonth();
  let d = now.getDate()     - start.getDate();
  if (d < 0) { m--; d += 30; }
  if (m < 0) { y--; m += 12; }
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} year${y > 1 ? 's' : ''}`);
  if (m > 0) parts.push(`${m} month${m > 1 ? 's' : ''}`);
  if (d > 0) parts.push(`${d} day${d > 1 ? 's' : ''}`);
  return parts.join(', ') || '< 1 day';
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

const empTypeLabel: Record<string, string> = {
  full_time: 'Full Time', part_time: 'Part Time', contract: 'Contract', intern: 'Intern',
};

const roleLabel: Record<string, string> = {
  super_admin:           'Super Admin',
  admin:                 'Admin',
  company_director:      'Company Director',
  hr_manager:            'HR Manager',
  hr_secretary:          'HR Secretary',
  procurement_manager:   'Procurement Manager',
  procurement_officer:   'Procurement Officer',
  site_engineer:         'Site Engineer',
  employee:              'Employee',
};

function maskIban(iban: string): string {
  if (!iban) return '—';
  return `${iban.slice(0, 2)}•• •••• ${iban.slice(-4)}`;
}
function maskAccount(acc: string): string {
  if (!acc) return '—';
  return `•••• ${acc.slice(-4)}`;
}

const TABS = ['Home', 'Profile', 'Account', 'Attendance', 'Requests', 'Documents', 'Custom Fields'];

const TAB_ICONS: Record<string, React.ReactNode> = {
  Home: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Profile: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Account: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  ),
  Attendance: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Requests: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  Documents: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
    </svg>
  ),
  'Custom Fields': (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
};

// ── Form field classes (design system) ────────────────────────────────────────
const inp = 'form-input';
const ta  = 'form-textarea';
const sel = 'form-select';
const fld = 'form-field';
const lbl = 'form-label';

// ── Sub-components ─────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="info-label">{label}</div>
      <div className="info-value">{value || '—'}</div>
    </div>
  );
}

function InfoField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  const isEmpty = !value || value === '—';
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{
        fontSize: 13,
        fontWeight: isEmpty ? 400 : 600,
        color: isEmpty ? 'var(--text-tertiary)' : 'var(--text-primary)',
        fontFamily: mono ? 'ui-monospace, monospace' : undefined,
        wordBreak: 'break-word',
      }}>
        {value || '—'}
      </div>
    </div>
  );
}

function SectionHead({ title, onEdit, isAdmin, hovered }: { title: string; onEdit?: () => void; isAdmin?: boolean; hovered?: boolean }) {
  return (
    <div className="section-head">
      <h3 className="section-head-title">{title}</h3>
      {isAdmin && onEdit && (
        <button
          onClick={onEdit}
          className="section-edit-btn"
        >
          Edit
        </button>
      )}
    </div>
  );
}

function CardHead({ title, isAdmin, editVisible, onEdit }: {
  title: string;
  isAdmin?: boolean;
  editVisible?: boolean;
  onEdit?: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
        textTransform: 'uppercase', color: 'var(--text-secondary)',
      }}>
        {title}
      </span>
      {isAdmin && onEdit && (
        <button
          onClick={onEdit}
          style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
            background: 'none', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)', padding: '2px 10px',
            cursor: 'pointer', lineHeight: 1.6,
          }}
        >
          Edit
        </button>
      )}
    </div>
  );
}

// ── Bank Accounts Section ──────────────────────────────────────────────────────

const INPUT_S: React.CSSProperties = {
  width: '100%', padding: '6px 10px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
  color: 'var(--text-primary)', fontSize: 'var(--text-sm)', outline: 'none', boxSizing: 'border-box',
};
const LBL_S: React.CSSProperties = {
  display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600,
  color: 'var(--text-secondary)', marginBottom: 3,
};

function BankAccountsSection({ empId, isAdmin }: { empId: number; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const blank = { bank_name: '', account_holder_name: '', iban: '', account_number: '', swift_code: '', is_primary: false };
  const [form, setForm] = useState<Partial<EmployeeBankAccount>>(blank);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['emp-bank-accounts', empId],
    queryFn:  () => hrEmployeesApi.getBankAccounts(empId),
    staleTime: 60_000,
  });

  const saveMut = useMutation({
    mutationFn: () => editId
      ? hrEmployeesApi.updateBankAccount(empId, editId, form)
      : hrEmployeesApi.addBankAccount(empId, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['emp-bank-accounts', empId] }); setAdding(false); setEditId(null); setForm(blank); toast('Saved', 'success'); },
    onError:   () => toast('Failed to save bank account', 'error'),
  });

  const delMut = useMutation({
    mutationFn: (accId: number) => hrEmployeesApi.deleteBankAccount(empId, accId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['emp-bank-accounts', empId] }); toast('Deleted', 'success'); },
    onError:   () => toast('Failed to delete', 'error'),
  });

  const openEdit = (acc: EmployeeBankAccount) => {
    setEditId(acc.id);
    setForm({ bank_name: acc.bank_name, account_holder_name: acc.account_holder_name, iban: acc.iban, account_number: acc.account_number, swift_code: acc.swift_code, is_primary: acc.is_primary });
    setAdding(true);
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
        <h3 className="section-head-title" style={{ margin: 0 }}>Bank Accounts</h3>
        {isAdmin && !adding && (
          <button onClick={() => { setEditId(null); setForm(blank); setAdding(true); }} style={{ fontSize: 'var(--text-xs)', color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            + Add Account
          </button>
        )}
      </div>

      {adding && (
        <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            {([
              ['Bank Name', 'bank_name'],
              ['Account Holder Name', 'account_holder_name'],
              ['IBAN', 'iban'],
              ['Account Number', 'account_number'],
              ['SWIFT / BIC Code', 'swift_code'],
            ] as [string, keyof EmployeeBankAccount][]).map(([label, key]) => (
              <div key={key}>
                <label style={LBL_S}>{label}</label>
                <input style={INPUT_S} value={(form[key] as string) ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
              <input type="checkbox" id="is_primary" checked={!!form.is_primary} onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))} />
              <label htmlFor="is_primary" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', cursor: 'pointer' }}>Primary (used for WPS)</label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>{saveMut.isPending ? 'Saving…' : editId ? 'Update' : 'Add'}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setEditId(null); setForm(blank); }}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Loading…</p>
      ) : accounts.length === 0 ? (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>No bank accounts on file.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{acc.bank_name || '—'}</span>
                  {acc.is_primary && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-subtle)', borderRadius: 4, padding: '1px 7px', letterSpacing: '0.03em' }}>WPS Primary</span>
                  )}
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => openEdit(acc)} style={{ fontSize: 'var(--text-xs)', color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                    <button onClick={() => delMut.mutate(acc.id)} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
                  </div>
                )}
              </div>
              {/* Fields grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2) var(--space-5)' }}>
                {([
                  ['Account Holder', acc.account_holder_name,              false],
                  ['IBAN',           maskIban(acc.iban || ''),              true ],
                  ['Account No.',    maskAccount(acc.account_number || ''), true ],
                  ['SWIFT / BIC',    acc.swift_code,                        true ],
                ] as [string, string, boolean][]).map(([lbl, val, mono]) => val && val !== '—' ? (
                  <div key={lbl}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 1 }}>{lbl}</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontFamily: mono ? 'ui-monospace, monospace' : undefined }}>{val}</div>
                  </div>
                ) : null)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

// ── Roles Tab ─────────────────────────────────────────────────────────────────

function RolesTab({ empUserId, isAdmin }: { empUserId?: number; isAdmin: boolean }) {
  const queryClient = useQueryClient();

  const { data: userRoles, isLoading } = useQuery({
    queryKey: ['user-roles', empUserId],
    queryFn: () => rolesApi.getUserRoles(empUserId!),
    enabled: !!empUserId,
    staleTime: 60_000,
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.getAll(),
    enabled: isAdmin,
    staleTime: 300_000,
  });

  const assignMutation = useMutation({
    mutationFn: ({ roleId, roleType }: { roleId: number; roleType: 'primary' | 'additional' }) =>
      rolesApi.assignToUser(roleId, empUserId!, roleType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles', empUserId] });
      toast('Role assigned', 'success');
    },
    onError: (err: unknown) => toast((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to assign role', 'error'),
  });

  const unassignMutation = useMutation({
    mutationFn: ({ roleId, roleType }: { roleId: number; roleType: 'primary' | 'additional' }) =>
      rolesApi.unassignFromUser(roleId, empUserId!, roleType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles', empUserId] });
      toast('Role removed', 'success');
    },
    onError: (err: unknown) => toast((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to remove role', 'error'),
  });

  if (!empUserId) return <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>No linked user account.</p>;
  if (isLoading) return <Loader />;
  if (!userRoles) return null;

  const additionalRoleIds = new Set(userRoles.additional_roles.map((a) => a.role.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* Primary role */}
      <div className="card">
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Primary Role</h3>
        {userRoles.primary_role ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: userRoles.primary_role.color || 'var(--border-subtle)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{userRoles.primary_role.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Level {userRoles.primary_role.level} · {userRoles.primary_role.permissions_count} permissions</div>
            </div>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                style={{ color: 'var(--error)' }}
                disabled={unassignMutation.isPending}
                onClick={() => unassignMutation.mutate({ roleId: userRoles.primary_role!.id, roleType: 'primary' })}
              >
                Remove
              </Button>
            )}
          </div>
        ) : (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>No primary role assigned.</p>
        )}
        {isAdmin && (
          <div style={{ marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <select
              className="form-select"
              style={{ maxWidth: 240 }}
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                assignMutation.mutate({ roleId: Number(e.target.value), roleType: 'primary' });
                e.target.value = '';
              }}
            >
              <option value="">Set primary role…</option>
              {allRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Additional roles */}
      <div className="card">
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Additional Roles</h3>
        {userRoles.additional_roles.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>No additional roles assigned.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {userRoles.additional_roles.map((assignment) => (
              <div key={assignment.assignment_id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--surface-subtle)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: assignment.role.color || 'var(--border-subtle)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{assignment.role.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    Level {assignment.role.level}
                    {assignment.granted_by && ` · Granted by ${assignment.granted_by}`}
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    style={{ color: 'var(--error)' }}
                    disabled={unassignMutation.isPending}
                    onClick={() => unassignMutation.mutate({ roleId: assignment.role.id, roleType: 'additional' })}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        {isAdmin && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <select
              className="form-select"
              style={{ maxWidth: 240 }}
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                assignMutation.mutate({ roleId: Number(e.target.value), roleType: 'additional' });
                e.target.value = '';
              }}
            >
              <option value="">Add additional role…</option>
              {allRoles.filter((r) => !additionalRoleIds.has(r.id)).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Effective permissions */}
      {userRoles.effective_permissions.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
            Effective Permissions ({userRoles.effective_permissions.length})
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {userRoles.effective_permissions.map((p) => (
              <span key={p} style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 4, background: 'var(--surface-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', fontFamily: 'monospace' }}>
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { hasPermission, isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin || hasPermission('hr.hr_employee.view');

  const [activeTab,     setActiveTab]     = useState('Profile');
  const [editSection,   setEditSection]   = useState<'personal' | 'professional' | 'contact' | 'legal' | 'salary' | 'account' | null>(null);
  const [form,          setForm]          = useState<Record<string, unknown>>({});
  const [avatarFile,    setAvatarFile]    = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [stampFile,     setStampFile]     = useState<File | null>(null);
  const [stampPreview,  setStampPreview]  = useState<string | null>(null);
  const [changePassword, setChangePassword] = useState(false);
  const [salaryRevealed, setSalaryRevealed] = useState(false);
  const [hoveredCard,    setHoveredCard]    = useState<string | null>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: emp, isLoading, error } = useQuery<HREmployee>({
    queryKey: ['hr-employee', id],
    queryFn:  () => hrEmployeesApi.getById(Number(id)),
  });

  const isSelf = !!emp && currentUser?.id === emp.user?.id;
  const { data: depts }           = useQuery({ queryKey: ['hr-departments-all'],    queryFn: () => hrDepartmentsApi.getAll({ page: 1 }),                                         staleTime: 300_000 });
  const { data: positions }       = useQuery({ queryKey: ['hr-positions-all'],      queryFn: () => hrPositionsApi.getAll({ page_size: 200 }),                                      staleTime: 300_000 });
  const { data: groups }          = useQuery({ queryKey: ['hr-employee-groups-all'],queryFn: () => hrEmployeeGroupsApi.getAll(),                                                   staleTime: 300_000 });
  const { data: officeLocations } = useQuery({ queryKey: ['hr-office-locations'],   queryFn: () => hrOfficeLocationsApi.getAll({ is_active: true }),                               staleTime: 300_000 });
  const { data: legalEntities }   = useQuery({ queryKey: ['hr-legal-entities'],     queryFn: () => hrLegalEntitiesApi.getAll(),                                                    staleTime: 300_000 });
  const { data: managers }        = useQuery({ queryKey: ['hr-managers'],           queryFn: () => hrEmployeesApi.getAll({ is_manager: true, is_active: true, page_size: 200 }),   staleTime: 60_000  });

  const deptOptions     = (depts?.results          ?? []).map((d)  => ({ value: d.id,  label: d.name }));
  const positionOptions = (positions?.results      ?? []).map((p)  => ({ value: p.id,  label: p.title }));
  const groupOptions    = (groups?.results         ?? []).map((g)  => ({ value: g.id,  label: g.name }));
  const locationOpts    = (officeLocations?.results ?? []).map((l)  => ({ value: l.id,  label: l.name }));
  const legalEntOpts    = (legalEntities?.results  ?? []).map((le) => ({ value: le.id, label: le.name }));
  const managerOpts     = (managers?.results       ?? []).map((m)  => ({ value: m.id,  label: `${m.full_name} (${m.employee_id})` }));
  const { data: summary }   = useQuery({
    queryKey: ['hr-emp-summary', id],
    queryFn:  () => hrEmployeesApi.getAttendanceSummary(Number(id)),
    enabled:  !!id,
    staleTime: 60_000,
  });

  // Switch to Home when viewing own profile (emp.user?.id defined after queries — placed here to avoid TDZ)
  useEffect(() => {
    if (emp?.user?.id && currentUser?.id === emp.user.id) {
      setActiveTab(t => t === 'Profile' ? 'Home' : t);
    }
  }, [emp?.user?.id, currentUser?.id]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (data: Partial<HREmployee>) => hrEmployeesApi.update(Number(id), data),
  });

  const userUpdateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      usersApi.update(emp!.user!.id, {
        ...data,
        ...(avatarFile ? { avatar: avatarFile } : {}),
        ...(stampFile  ? { stamp:  stampFile  } : {}),
      } as Partial<User> & { password?: string; avatar?: File; stamp?: File }),
  });

  const isSaving = updateMutation.isPending || userUpdateMutation.isPending;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const f = (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value }));

  const openEdit = (section: typeof editSection) => {
    if (!emp) return;
    setAvatarFile(null);
    setAvatarPreview(null);
    setStampFile(null);
    setStampPreview(null);
    setChangePassword(false);
    setForm({
      // Personal (incl. User name fields)
      first_name:           emp.user?.first_name || '',
      last_name:            emp.user?.last_name  || '',
      full_name_ar:         emp.user?.full_name_ar || '',
      gender:               emp.gender || '',
      date_of_birth:        emp.date_of_birth || '',
      marital_status:       emp.marital_status || '',
      nationality:          emp.nationality || '',
      home_country:         emp.home_country || '',
      religion:             emp.religion || '',
      national_id:          emp.national_id || '',
      passport_number:      emp.passport_number || '',
      passport_issue_date:  emp.passport_issue_date || '',
      passport_expiry_date: emp.passport_expiry_date || '',
      // Professional
      employee_id:          emp.employee_id || '',
      employment_type:      emp.employment_type || 'full_time',
      employee_group:       emp.employee_group ?? '',
      department:           emp.department ?? '',
      position:             emp.position ?? '',
      office_location:      emp.office_location ?? '',
      legal_entity:         emp.legal_entity ?? '',
      direct_manager:       emp.direct_manager ?? '',
      join_date:            emp.join_date || '',
      probation_end_date:   emp.probation_end_date || '',
      end_date:             emp.end_date || '',
      // Salary
      basic_salary:         emp.basic_salary || '0',
      housing_allowance:    emp.housing_allowance || '0',
      transport_allowance:  emp.transport_allowance || '0',
      other_allowances:     emp.other_allowances || '0',
      // Contact
      mobile_number:        emp.mobile_number || '',
      extension_number:     emp.extension_number || '',
      address:              emp.address || '',
      personal_email:       emp.personal_email || '',
      // UAE Legal
      resident_id:          emp.resident_id || '',
      is_citizen:           emp.is_citizen ?? false,
      labor_card:           emp.labor_card || '',
      labor_card_expiry:    emp.labor_card_expiry || '',
      mol_number:           emp.mol_number || '',
      sponsor_name:         emp.sponsor_name || '',
      sponsor_id:           emp.sponsor_id || '',
      // Account
      username:             emp.user?.username || '',
      email:                emp.user?.email || '',
      role:                 emp.user?.role || '',
      is_active:            emp.is_active,
      password:             '',
      password2:            '',
    });
    setEditSection(section);
  };

  const handleSave = async () => {
    if (!emp) return;
    try {
      const str = (v: unknown): string | undefined => (v as string) || undefined;
      const fk  = (v: unknown): number | undefined => v ? Number(v) : undefined;

      if (editSection === 'account') {
        if (changePassword) {
          if (!(form.password as string) || (form.password as string).length < 8) { toast('Password must be at least 8 characters', 'error'); return; }
          if (form.password !== form.password2) { toast('Passwords do not match', 'error'); return; }
        }
        const accountData: Record<string, unknown> = {
          username: form.username,
          email:    form.email,
          role:     form.role,
        };
        if (changePassword && form.password) accountData.password = form.password;
        await userUpdateMutation.mutateAsync(accountData);
        await updateMutation.mutateAsync({ is_active: form.is_active as boolean });

      } else {
        let payload: Partial<HREmployee> = {};

        if (editSection === 'personal') {
          if (emp.user?.id) {
            await usersApi.update(emp.user.id, {
              first_name:   form.first_name   as string || '',
              last_name:    form.last_name    as string || '',
              full_name_ar: form.full_name_ar as string || '',
            } as Partial<User> & { password?: string; avatar?: File; stamp?: File });
          }
          payload = {
            gender:               str(form.gender),
            date_of_birth:        str(form.date_of_birth),
            marital_status:       str(form.marital_status),
            nationality:          str(form.nationality),
            home_country:         str(form.home_country),
            religion:             str(form.religion),
            national_id:          str(form.national_id),
            passport_number:      str(form.passport_number),
            passport_issue_date:  str(form.passport_issue_date),
            passport_expiry_date: str(form.passport_expiry_date),
          };
        } else if (editSection === 'professional') {
          payload = {
            employee_id:        str(form.employee_id),
            employment_type:    str(form.employment_type) as HREmployee['employment_type'],
            employee_group:     fk(form.employee_group),
            department:         fk(form.department),
            position:           fk(form.position),
            legal_entity:       fk(form.legal_entity),
            office_location:    fk(form.office_location),
            direct_manager:     fk(form.direct_manager),
            join_date:          str(form.join_date),
            probation_end_date: str(form.probation_end_date),
            end_date:           str(form.end_date),
          };
        } else if (editSection === 'contact') {
          payload = {
            mobile_number:    str(form.mobile_number),
            extension_number: str(form.extension_number),
            address:          str(form.address),
            personal_email:   str(form.personal_email),
          };
        } else if (editSection === 'legal') {
          payload = {
            resident_id:       str(form.resident_id),
            is_citizen:        form.is_citizen as boolean,
            labor_card:        str(form.labor_card),
            labor_card_expiry: str(form.labor_card_expiry),
            mol_number:        str(form.mol_number),
            sponsor_name:      str(form.sponsor_name),
            sponsor_id:        str(form.sponsor_id),
          };
        } else if (editSection === 'salary') {
          payload = {
            basic_salary:        form.basic_salary        as string,
            housing_allowance:   form.housing_allowance   as string,
            transport_allowance: form.transport_allowance as string,
            other_allowances:    form.other_allowances    as string,
          };
        }

        await updateMutation.mutateAsync(payload);
      }

      queryClient.invalidateQueries({ queryKey: ['hr-employee', id] });
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      toast('Saved successfully', 'success');
      setEditSection(null);
      setAvatarFile(null); setAvatarPreview(null);
      setStampFile(null);  setStampPreview(null);
      setChangePassword(false);

    } catch (err: unknown) {
      const raw = (err as { response?: { data?: unknown } })?.response?.data;
      if (raw && typeof raw === 'object') {
        const msg = Object.entries(raw as Record<string, unknown>)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
          .join(' | ');
        toast(msg, 'error');
      } else {
        toast('Failed to save', 'error');
      }
    }
  };

  // ── Loading / error ────────────────────────────────────────────────────────
  if (isLoading) return (
    <MainLayout>
      <PageShell>
        <div className="skeleton" style={{ height: 72, marginBottom: 'var(--space-4)' }} />
        <div className="skeleton" style={{ height: 36, marginBottom: 'var(--space-5)', borderRadius: 0 }} />
        <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
          <div className="skeleton" style={{ width: 300, height: 500, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="skeleton" style={{ height: 200 }} />
            <div className="skeleton" style={{ height: 160 }} />
          </div>
        </div>
      </PageShell>
    </MainLayout>
  );

  if (error || !emp) return (
    <MainLayout>
      <PageShell>
        <div className="card empty-state">
          <p className="empty-state-title">Employee not found</p>
          <p className="empty-state-desc">The requested employee record could not be loaded</p>
        </div>
      </PageShell>
    </MainLayout>
  );

  const avatarSrc    = avatarPreview || emp.user?.avatar || emp.avatar || null;
  const avatarLetter = (emp.full_name || emp.user?.username || '?')[0].toUpperCase();

  const drawerTitle =
    editSection === 'account'       ? 'Edit Account & Access'
    : editSection === 'personal'    ? 'Edit Personal Info'
    : editSection === 'professional'? 'Edit Professional Info'
    : editSection === 'contact'     ? 'Edit Contact Info'
    : editSection === 'legal'       ? 'Edit UAE Legal Info'
    : 'Edit Salary Package';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <PageShell>

        {/* ── Back link ── */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <a href={isAdmin ? '/hr/employees' : '/dashboard'} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none',
            fontWeight: 500,
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            {isAdmin ? 'Employees' : 'Dashboard'}
          </a>
        </div>

        {/* ── Executive Header ── */}
        <div style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '20px 24px',
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {avatarSrc ? (
                <img src={avatarSrc} alt={emp.full_name} style={{
                  width: 72, height: 72, borderRadius: '50%', objectFit: 'cover',
                  border: '2px solid var(--border-subtle)',
                }} />
              ) : (
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.75rem', fontWeight: 700, color: '#fff',
                  border: '2px solid var(--border-subtle)',
                }}>{avatarLetter}</div>
              )}
              <span style={{
                position: 'absolute', bottom: 2, right: 2,
                width: 13, height: 13, borderRadius: '50%',
                border: '2px solid var(--surface-card)',
                background: emp.is_active ? 'var(--status-success)' : 'var(--status-error)',
              }} />
            </div>

            {/* Identity */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.025em', margin: 0, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                  {emp.full_name}
                </h1>
                {emp.user?.full_name_ar && (
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 400, direction: 'rtl' }}>
                    {emp.user.full_name_ar}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 10px', fontWeight: 400 }}>
                {[emp.position_title, emp.department_name, emp.legal_entity_name].filter(Boolean).join(' · ') || 'No position assigned'}
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Badge variant={emp.is_active ? 'success' : 'error'}>{emp.is_active ? 'Active' : 'Inactive'}</Badge>
                {emp.employment_type && <Badge variant="default">{empTypeLabel[emp.employment_type] || emp.employment_type}</Badge>}
                {emp.employee_group_name && <Badge variant="default">{emp.employee_group_name}</Badge>}
              </div>
            </div>

            {/* Actions */}
            {isAdmin && (
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignSelf: 'flex-start' }}>
                <Button variant="secondary" size="sm" onClick={() => openEdit('account')}>Edit Account</Button>
                <Button
                  variant={emp.is_active ? 'delete' : 'primary'} size="sm"
                  isLoading={updateMutation.isPending}
                  onClick={() => updateMutation.mutate({ is_active: !emp.is_active })}
                >
                  {emp.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            )}
          </div>

          {/* Quick info strip */}
          <div style={{
            display: 'flex', gap: 0, marginTop: 16,
            paddingTop: 14, borderTop: '1px solid var(--border-subtle)',
            overflowX: 'auto',
          }}>
            {([
              { label: 'Employee ID', value: emp.employee_id, mono: true },
              emp.join_date ? { label: 'Hire Date', value: fmtDate(emp.join_date), mono: false } : null,
              emp.join_date ? { label: 'Tenure', value: calcPeriod(emp.join_date), mono: false } : null,
              emp.user?.email ? { label: 'Work Email', value: emp.user.email, mono: false } : null,
              (emp.direct_manager_name || emp.direct_manager_detail?.full_name) ? {
                label: 'Reports To',
                value: emp.direct_manager_name || emp.direct_manager_detail!.full_name, mono: false,
              } : null,
              emp.mobile_number ? { label: 'Mobile', value: emp.mobile_number, mono: false } : null,
              emp.office_location_name ? { label: 'Work Location', value: emp.office_location_name, mono: false } : null,
            ] as ({ label: string; value: string; mono: boolean } | null)[]).filter(Boolean).map((item, i) => (
              <div key={item!.label} style={{
                display: 'flex', flexDirection: 'column', gap: 2,
                padding: '0 20px', flexShrink: 0,
                borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {item!.label}
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                  fontFamily: item!.mono ? 'ui-monospace, monospace' : undefined,
                  whiteSpace: 'nowrap',
                }}>
                  {item!.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tab bar — pill style ── */}
        <div style={{
          display: 'flex',
          gap: 2,
          padding: 4,
          background: 'var(--surface-subtle)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--space-5)',
          overflowX: 'auto',
        }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 'calc(var(--radius-lg) - 2px)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === tab ? 600 : 500,
                background: activeTab === tab ? 'var(--surface-card)' : 'transparent',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)',
                boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.07), 0 0 0 1px var(--border-subtle)' : 'none',
                transition: 'background 0.12s, color 0.12s, box-shadow 0.12s',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <span style={{ opacity: activeTab === tab ? 1 : 0.6 }}>{TAB_ICONS[tab]}</span>
              {tab}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        {(() => {
          const tabProps = {
            user: emp.user, emp, depts: depts?.results ?? [], positions: positions?.results ?? [],
            locations: [], isSelf, isAdmin, userId: emp.user?.id ?? 0,
          };

          if (activeTab === 'Home')       return <HomeTab       {...tabProps} />;
          if (activeTab === 'Attendance') return <AttendanceTab {...tabProps} />;
          if (activeTab === 'Requests')   return <RequestsTab   {...tabProps} />;
          if (activeTab === 'Documents')  return <DocumentsTab  {...tabProps} />;

          if (activeTab === 'Account') return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 'var(--space-5)', alignItems: 'start' }}>

              {/* Left — account info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                    {avatarSrc ? (
                      <img src={avatarSrc} alt={emp.full_name} className="av" style={{ width: 56, height: 56 }} />
                    ) : (
                      <div className="av-initials" style={{ width: 56, height: 56, fontSize: '1.25rem' }}>{avatarLetter}</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 'var(--text-base)', margin: 0 }}>{emp.full_name}</p>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.user?.email || '—'}</p>
                    </div>
                    {isAdmin && (
                      <Button variant="secondary" size="sm" onClick={() => openEdit('account')}>Edit</Button>
                    )}
                  </div>
                  <div className="info-grid">
                    <InfoRow label="Username"   value={emp.user?.username} />
                    <InfoRow label="Work Email" value={emp.user?.email} />
                    <InfoRow label="Role"       value={emp.user?.role?.replace(/_/g, ' ')} />
                    <InfoRow label="Status"     value={emp.is_active ? 'Active' : 'Inactive'} />
                  </div>
                </div>

                {/* Signature stamp */}
                {(emp.user as any)?.stamp_url && (
                  <div className="card">
                    <SectionHead title="Signature Stamp" />
                    <div style={{
                      width: 120, height: 80, border: '1px solid var(--border-subtle)',
                      borderRadius: 8, overflow: 'hidden', background: 'var(--surface-subtle)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginTop: 8,
                    }}>
                      <img src={(emp.user as any).stamp_url} alt="stamp" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Right — roles */}
              <div>
                <RolesTab empUserId={emp.user?.id} isAdmin={isAdmin} />
              </div>
            </div>
          );

          if (activeTab === 'Custom Fields') return (
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 16 }}>Custom Fields</div>
              <CustomFieldsSection
                entityType="employee"
                entityBaseUrl="/hr/employees/"
                objectId={emp.id}
                readOnly={!isAdmin}
              />
            </div>
          );

          if (activeTab !== 'Profile') return (
            <div className="card empty-state">
              <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
              </svg>
              <p className="empty-state-title">Coming Soon</p>
              <p className="empty-state-desc">This section is under development</p>
            </div>
          );

          // ── Profile Tab ────────────────────────────────────────────────
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

            {/* Attendance snapshot */}
            <div style={{
              display: 'flex',
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}>
              {([
                { key: 'present',  label: 'Present Days', color: 'var(--status-success)' },
                { key: 'absent',   label: 'Absent Days',  color: 'var(--status-error)'   },
                { key: 'late',     label: 'Late Days',    color: 'var(--status-warning)' },
                { key: 'on_leave', label: 'Leave Days',   color: 'var(--status-info)'    },
              ] as { key: string; label: string; color: string }[]).map((s, i) => (
                <div key={s.key} style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 18px',
                  borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1, letterSpacing: '-0.04em' }}>
                    {(summary?.summary as Record<string, number> | undefined)?.[s.key] ?? 0}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Identity rail (left) + Main content (right) */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 'var(--space-4)', alignItems: 'start' }}>

              {/* ── LEFT: Identity Rail ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

                {/* Personal Identity */}
                <div className="card"
                  onMouseEnter={() => setHoveredCard('personal')}
                  onMouseLeave={() => setHoveredCard(null)}>
                  <CardHead title="Personal Information" isAdmin={isAdmin} editVisible={hoveredCard === 'personal'} onEdit={() => openEdit('personal')} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                    <InfoField label="First Name"     value={emp.user?.first_name || undefined} />
                    <InfoField label="Last Name"      value={emp.user?.last_name  || undefined} />
                    {emp.user?.full_name_ar && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <InfoField label="Arabic Full Name" value={emp.user.full_name_ar} />
                      </div>
                    )}
                    <InfoField label="Gender"         value={emp.gender ? emp.gender.charAt(0).toUpperCase() + emp.gender.slice(1) : undefined} />
                    <InfoField label="Marital Status" value={emp.marital_status ? emp.marital_status.charAt(0).toUpperCase() + emp.marital_status.slice(1) : undefined} />
                    <InfoField label="Date of Birth"  value={fmtDate(emp.date_of_birth)} />
                    <InfoField label="Age"            value={calcAge(emp.date_of_birth)} />
                    <InfoField label="Nationality"    value={emp.nationality} />
                    <InfoField label="Home Country"   value={emp.home_country} />
                    <InfoField label="Religion"       value={emp.religion} />
                    <InfoField label="National ID"    value={emp.national_id} />
                  </div>
                  {/* Travel documents sub-section */}
                  {(emp.passport_number || emp.passport_issue_date || emp.passport_expiry_date) && (<>
                    <div style={{ margin: '14px 0 12px', borderTop: '1px solid var(--border-subtle)' }} />
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Travel Documents</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                      <InfoField label="Passport No."    value={emp.passport_number} />
                      <InfoField label="Issue Date"      value={fmtDate(emp.passport_issue_date)} />
                      <InfoField label="Expiry Date"     value={fmtDate(emp.passport_expiry_date)} />
                    </div>
                  </>)}
                </div>

                {/* Contact Details */}
                <div className="card"
                  onMouseEnter={() => setHoveredCard('contact')}
                  onMouseLeave={() => setHoveredCard(null)}>
                  <CardHead title="Contact Details" isAdmin={isAdmin} editVisible={hoveredCard === 'contact'} onEdit={() => openEdit('contact')} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                    <InfoField label="Mobile Number"  value={emp.mobile_number} />
                    <InfoField label="Extension"      value={emp.extension_number} />
                    <InfoField label="Personal Email" value={emp.personal_email} />
                    <InfoField label="Address"        value={emp.address} />
                  </div>
                </div>

                {/* UAE Legal & Visa */}
                <div className="card"
                  onMouseEnter={() => setHoveredCard('legal')}
                  onMouseLeave={() => setHoveredCard(null)}>
                  <CardHead title="UAE Legal & Visa" isAdmin={isAdmin} editVisible={hoveredCard === 'legal'} onEdit={() => openEdit('legal')} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                    <InfoField label="Resident ID"       value={emp.resident_id} />
                    <InfoField label="UAE Citizen"       value={emp.is_citizen ? 'Yes' : 'No'} />
                    <InfoField label="Labor Card No."    value={emp.labor_card} />
                    <InfoField label="Labor Card Expiry" value={fmtDate(emp.labor_card_expiry)} />
                    <InfoField label="MOL Number"        value={emp.mol_number} />
                  </div>
                  {(emp.sponsor_name || emp.sponsor_id) && (<>
                    <div style={{ margin: '14px 0 12px', borderTop: '1px solid var(--border-subtle)' }} />
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Sponsorship</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                      <InfoField label="Sponsor Name" value={emp.sponsor_name} />
                      <InfoField label="Sponsor ID"   value={emp.sponsor_id} />
                    </div>
                  </>)}
                </div>

                {/* Emergency Contact */}
                {emp.emergency_contact && (
                  <div className="card">
                    <CardHead title="Emergency Contact" isAdmin={false} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                      <InfoField label="Name"         value={emp.emergency_contact.name} />
                      <InfoField label="Relationship" value={emp.emergency_contact.relationship} />
                      <InfoField label="Phone"        value={emp.emergency_contact.phone} />
                    </div>
                  </div>
                )}

                {/* Bank Accounts */}
                <BankAccountsSection empId={emp.id} isAdmin={isAdmin} />

              </div>

              {/* ── RIGHT: Main Content ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

                {/* Employment Details */}
                <div className="card"
                  onMouseEnter={() => setHoveredCard('professional')}
                  onMouseLeave={() => setHoveredCard(null)}>
                  <CardHead title="Employment Details" isAdmin={isAdmin} editVisible={hoveredCard === 'professional'} onEdit={() => openEdit('professional')} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px 16px' }}>
                    <InfoField label="Position"          value={emp.position_title} />
                    <InfoField label="Department"        value={emp.department_name} />
                    <InfoField label="Employee Category" value={emp.employee_group_name} />
                    <InfoField label="Employment Type"   value={empTypeLabel[emp.employment_type] || emp.employment_type} />
                    <InfoField label="Legal Entity"      value={emp.legal_entity_name ?? undefined} />
                    <InfoField label="Work Location"     value={emp.office_location_name} />
                    <InfoField label="Direct Manager"    value={emp.direct_manager_detail?.full_name ?? emp.direct_manager_name ?? undefined} />
                    <InfoField label="Hiring Date"       value={fmtDate(emp.join_date)} />
                    <InfoField label="Employment Period" value={emp.join_date ? calcPeriod(emp.join_date) : undefined} />
                    <InfoField label="Probation End"     value={fmtDate(emp.probation_end_date)} />
                    <InfoField label="Contract End Date" value={fmtDate(emp.end_date)} />
                  </div>
                </div>

                {/* Account & Access — admin only */}
                {isAdmin && (
                  <div className="card"
                    onMouseEnter={() => setHoveredCard('account')}
                    onMouseLeave={() => setHoveredCard(null)}>
                    <CardHead title="Account & Access" isAdmin={isAdmin} editVisible={hoveredCard === 'account'} onEdit={() => openEdit('account')} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px 16px' }}>
                      <InfoField label="Username"   value={emp.user?.username} />
                      <InfoField label="Work Email" value={emp.user?.email} />
                      <InfoField label="System Role" value={emp.user?.role ? (roleLabel[emp.user.role] || emp.user.role) : undefined} />
                    </div>
                  </div>
                )}

                {/* Compensation — admin only, hidden until hovered or revealed */}
                {isAdmin && (
                  <div className="card"
                    onMouseEnter={() => { setHoveredCard('salary'); setSalaryRevealed(true); }}
                    onMouseLeave={() => { setHoveredCard(null); setSalaryRevealed(false); }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                          Compensation
                        </span>
                        {!salaryRevealed && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)' }}>
                            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                          </svg>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          onClick={e => { e.stopPropagation(); setSalaryRevealed(v => !v); }}
                          style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 10px',
                            borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
                            background: 'var(--surface-subtle)', color: 'var(--text-secondary)',
                            cursor: 'pointer', lineHeight: 1.6,
                          }}
                        >{salaryRevealed ? 'Hide' : 'Show'}</button>
                        <button
                          onClick={() => openEdit('salary')}
                          style={{
                            opacity: hoveredCard === 'salary' ? 1 : 0, transition: 'opacity 0.15s',
                            fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', background: 'none',
                            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                            padding: '2px 10px', cursor: 'pointer', lineHeight: 1.6,
                          }}
                        >Edit</button>
                      </div>
                    </div>

                    {/* Breakdown tiles */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                      {([
                        ['Basic Salary', emp.basic_salary],
                        ['Housing',      emp.housing_allowance],
                        ['Transport',    emp.transport_allowance],
                        ['Other',        emp.other_allowances],
                      ] as [string, string | undefined][]).map(([label, val]) => (
                        <div key={label} style={{
                          background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)', padding: '10px 12px',
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
                          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 3 }}>
                            {salaryRevealed
                              ? Number(val).toLocaleString('en-US', { minimumFractionDigits: 0 })
                              : <span style={{ letterSpacing: 2, color: 'var(--text-tertiary)', fontSize: 14 }}>••••</span>}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}>AED / month</div>
                        </div>
                      ))}
                    </div>

                    {/* Total package */}
                    <div style={{
                      marginTop: 12, padding: '12px 16px',
                      background: 'var(--brand-subtle)', border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
                          Total Monthly Package
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-brand)', lineHeight: 1, letterSpacing: '-0.03em' }}>
                          {salaryRevealed
                            ? <>{Number(emp.total_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>AED</span></>
                            : <span style={{ fontSize: 18, letterSpacing: 3, color: 'var(--text-tertiary)', fontWeight: 400 }}>•••••••</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>Annual</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)' }}>
                          {salaryRevealed
                            ? <>{(Number(emp.total_salary) * 12).toLocaleString('en-US', { minimumFractionDigits: 0 })} AED</>
                            : <span style={{ letterSpacing: 2 }}>••••••• AED</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            </div>
          );
        })()}
      </PageShell>

      {/* ══ EDIT DRAWER ════════════════════════════════════════════════════════ */}
      <Drawer
        isOpen={!!editSection}
        onClose={() => setEditSection(null)}
        title={drawerTitle}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditSection(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
              {isSaving ? 'Saving…' : 'Save Changes'}
            </Button>
          </>
        }
      >
        {/* ─ Account & Access ─ */}
        {editSection === 'account' && (
          <>
            <div className={fld}>
              <label className={lbl}>Profile Picture</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                  background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {avatarPreview || avatarSrc ? (
                    <img src={avatarPreview || avatarSrc || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '1.5rem', color: 'var(--text-tertiary)' }}>{avatarLetter}</span>
                  )}
                </div>
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) { toast('Max 5MB', 'error'); return; }
                      setAvatarFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => setAvatarPreview(reader.result as string);
                      reader.readAsDataURL(file);
                    }} />
                  <button type="button" className="btn btn-secondary"
                    style={{ fontSize: 'var(--text-xs)', padding: '4px 12px' }}
                    onClick={() => fileInputRef.current?.click()}>
                    {avatarPreview || avatarSrc ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                    JPG, PNG — max 5 MB
                  </p>
                </div>
              </div>
            </div>

            <div className={fld}>
              <label className={lbl}>Signature Stamp</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div style={{
                  width: 80, height: 80, border: '1px dashed var(--border-default)',
                  borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-subtle)', overflow: 'hidden', flexShrink: 0,
                }}>
                  {stampPreview || emp.user?.stamp_url ? (
                    <img src={stampPreview || emp.user?.stamp_url || ''} alt="Stamp"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textAlign: 'center', padding: 4 }}>No stamp</span>
                  )}
                </div>
                <div>
                  <input ref={stampInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) { toast('Max 5MB', 'error'); return; }
                      setStampFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => setStampPreview(reader.result as string);
                      reader.readAsDataURL(file);
                    }} />
                  <button type="button" className="btn btn-secondary"
                    style={{ fontSize: 'var(--text-xs)', padding: '4px 12px' }}
                    onClick={() => stampInputRef.current?.click()}>
                    {stampPreview || emp.user?.stamp_url ? 'Change Stamp' : 'Upload Stamp'}
                  </button>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                    SVG, PNG (transparent background) — max 5 MB
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              <div className={fld}><label className={lbl}>Username</label><input className={inp} value={form.username as string} onChange={f('username')} /></div>
              <div className={fld}><label className={lbl}>Work Email</label><input className={inp} type="email" value={form.email as string} onChange={f('email')} /></div>
              <div className={fld}>
                <label className={lbl}>Role</label>
                <select className={sel} value={form.role as string} onChange={f('role')}>
                  <option value="">— Select Role —</option>
                  <option value="employee">Employee</option>
                  <option value="hr_secretary">HR Secretary</option>
                  <option value="hr_manager">HR Manager</option>
                  <option value="procurement_officer">Procurement Officer</option>
                  <option value="procurement_manager">Procurement Manager</option>
                  <option value="site_engineer">Site Engineer</option>
                  <option value="company_director">Company Director</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div className={fld}>
                <label className={lbl}>Account Status</label>
                <select className={sel} value={form.is_active ? 'true' : 'false'}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.value === 'true' }))}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', marginBottom: 'var(--space-3)' }}>
                <input type="checkbox" checked={changePassword}
                  onChange={e => {
                    setChangePassword(e.target.checked);
                    if (!e.target.checked) setForm(p => ({ ...p, password: '', password2: '' }));
                  }} />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                  Change Password
                </span>
              </label>
              {changePassword && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div className={fld}><label className={lbl}>New Password</label><input className={inp} type="password" placeholder="Min 8 characters" value={form.password as string} onChange={f('password')} /></div>
                  <div className={fld}><label className={lbl}>Confirm Password</label><input className={inp} type="password" placeholder="Repeat password" value={form.password2 as string} onChange={f('password2')} /></div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─ Personal ─ */}
        {editSection === 'personal' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className={fld}><label className={lbl}>First Name</label><input className={inp} value={form.first_name as string} onChange={f('first_name')} /></div>
            <div className={fld}><label className={lbl}>Last Name</label><input className={inp} value={form.last_name as string} onChange={f('last_name')} /></div>
            <div className={fld} style={{ gridColumn: '1 / -1' }}><label className={lbl}>Arabic Name</label><input className={inp} dir="rtl" value={form.full_name_ar as string} onChange={f('full_name_ar')} /></div>
            <div className={fld}>
              <label className={lbl}>Gender</label>
              <select className={sel} value={form.gender as string} onChange={f('gender')}>
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className={fld}><label className={lbl}>Date of Birth</label><DateInput className={inp} value={(form.date_of_birth as string) ?? ''} onChange={(v) => setForm(p => ({ ...p, date_of_birth: v }))} /></div>
            <div className={fld}>
              <label className={lbl}>Marital Status</label>
              <select className={sel} value={form.marital_status as string} onChange={f('marital_status')}>
                <option value="">—</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </div>
            <div className={fld}><label className={lbl}>Nationality</label><input className={inp} value={form.nationality as string} onChange={f('nationality')} /></div>
            <div className={fld}><label className={lbl}>Home Country</label><input className={inp} value={form.home_country as string} onChange={f('home_country')} /></div>
            <div className={fld}><label className={lbl}>Religion</label><input className={inp} value={form.religion as string} onChange={f('religion')} /></div>
            <div className={fld}><label className={lbl}>National ID (Emirates ID)</label><input className={inp} value={form.national_id as string} onChange={f('national_id')} placeholder="XXX-XXXX-XXXXXXX-X" /></div>
            <div className={fld}><label className={lbl}>Passport Number</label><input className={inp} value={form.passport_number as string} onChange={f('passport_number')} /></div>
            <div className={fld}><label className={lbl}>Passport Issue Date</label><DateInput className={inp} value={(form.passport_issue_date as string) ?? ''} onChange={(v) => setForm(p => ({ ...p, passport_issue_date: v }))} /></div>
            <div className={fld}><label className={lbl}>Passport Expiry Date</label><DateInput className={inp} value={(form.passport_expiry_date as string) ?? ''} onChange={(v) => setForm(p => ({ ...p, passport_expiry_date: v }))} /></div>
          </div>
        )}

        {/* ─ Professional ─ */}
        {editSection === 'professional' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className={fld}>
              <label className={lbl}>Employee ID</label>
              <input className={inp} value={form.employee_id as string ?? ''} onChange={f('employee_id')} placeholder="e.g. EMP-0169" />
            </div>
            <div className={fld}>
              <label className={lbl}>Employment Type</label>
              <select className={sel} value={form.employment_type as string} onChange={f('employment_type')}>
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
            </div>
            <div className={fld}>
              <label className={lbl}>Employee Category</label>
              <SearchableDropdown options={groupOptions} value={form.employee_group ? Number(form.employee_group) : null}
                onChange={(v) => setForm((p) => ({ ...p, employee_group: v ? String(v) : '' }))}
                placeholder="— None —" allowClear
                onCreateOption={async (label) => {
                  const code = label.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 20);
                  const g = await hrEmployeeGroupsApi.create({ name: label, name_ar: '', code, description: '', is_active: true });
                  queryClient.invalidateQueries({ queryKey: ['hr-employee-groups-all'] });
                  return { value: g.id, label: g.name };
                }} />
            </div>
            <div className={fld}>
              <label className={lbl}>Department</label>
              <SearchableDropdown options={deptOptions} value={form.department ? Number(form.department) : null}
                onChange={(v) => setForm((p) => ({ ...p, department: v ? String(v) : '' }))}
                placeholder="— None —" allowClear
                onCreateOption={async (name) => {
                  const dept = await hrDepartmentsApi.create({ name });
                  queryClient.invalidateQueries({ queryKey: ['hr-departments-all'] });
                  toast(`Department "${name}" created`, 'success');
                  return { value: dept.id, label: dept.name };
                }} />
            </div>
            <div className={fld}>
              <label className={lbl}>Position</label>
              <SearchableDropdown options={positionOptions} value={form.position ? Number(form.position) : null}
                onChange={(v) => {
                  const selPos = v ? (positions?.results ?? []).find(p => p.id === Number(v)) : null;
                  setForm((p) => ({ ...p, position: v ? String(v) : '', ...(selPos?.department != null ? { department: String(selPos.department) } : {}) }));
                }}
                placeholder="— None —" allowClear
                onCreateOption={async (title) => {
                  const pos = await hrPositionsApi.create({ title });
                  queryClient.invalidateQueries({ queryKey: ['hr-positions-all'] });
                  toast(`Position "${title}" created`, 'success');
                  return { value: pos.id, label: pos.title };
                }} />
            </div>
            <div className={fld}>
              <label className={lbl}>Legal Entity</label>
              <SearchableDropdown options={legalEntOpts} value={form.legal_entity ? Number(form.legal_entity) : null}
                onChange={(v) => setForm((p) => ({ ...p, legal_entity: v ? String(v) : '' }))}
                placeholder="— None —" allowClear
                onCreateOption={async (name) => {
                  const le = await hrLegalEntitiesApi.create({ name });
                  queryClient.invalidateQueries({ queryKey: ['hr-legal-entities'] });
                  return { value: le.id, label: le.name };
                }} />
            </div>
            <div className={fld}>
              <label className={lbl}>Work Location</label>
              <SearchableDropdown options={locationOpts} value={form.office_location ? Number(form.office_location) : null}
                onChange={(v) => setForm((p) => ({ ...p, office_location: v ? String(v) : '' }))}
                placeholder="— None —" allowClear />
            </div>
            <div className={fld}>
              <label className={lbl}>Direct Manager</label>
              <SearchableDropdown options={managerOpts} value={form.direct_manager ? Number(form.direct_manager) : null}
                onChange={(v) => setForm((p) => ({ ...p, direct_manager: v ? String(v) : '' }))}
                placeholder="— None —" allowClear />
            </div>

            <div className={fld}><label className={lbl}>Hiring Date</label><DateInput className={inp} value={(form.join_date as string) ?? ''} onChange={(v) => setForm(p => ({ ...p, join_date: v }))} /></div>
            <div className={fld}><label className={lbl}>End of Probation</label><DateInput className={inp} value={(form.probation_end_date as string) ?? ''} onChange={(v) => setForm(p => ({ ...p, probation_end_date: v }))} /></div>
            <div className={fld}><label className={lbl}>Contract End Date</label><DateInput className={inp} value={(form.end_date as string) ?? ''} onChange={(v) => setForm(p => ({ ...p, end_date: v }))} /></div>
          </div>
        )}

        {/* ─ Contact ─ */}
        {editSection === 'contact' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className={fld}>
              <label className={lbl}>Mobile Number</label>
              <PhoneInput value={form.mobile_number as string} onChange={v => setForm(p => ({ ...p, mobile_number: v }))} />
            </div>
            <div className={fld}><label className={lbl}>Extension Number</label><input className={inp} value={form.extension_number as string} onChange={f('extension_number')} /></div>
            <div className={fld}><label className={lbl}>Personal Email</label><input className={inp} type="email" value={form.personal_email as string} onChange={f('personal_email')} /></div>
            <div className={fld} style={{ gridColumn: '1 / -1' }}>
              <label className={lbl}>Residential Address</label>
              <textarea className={ta} rows={3} value={form.address as string} onChange={f('address')} />
            </div>
          </div>
        )}

        {/* ─ UAE Legal ─ */}
        {editSection === 'legal' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className={fld}><label className={lbl}>Resident ID</label><input className={inp} value={form.resident_id as string} onChange={f('resident_id')} /></div>
            <div className={fld}><label className={lbl}>Labor Card Number</label><input className={inp} value={form.labor_card as string} onChange={f('labor_card')} /></div>
            <div className={fld}><label className={lbl}>Labor Card Expiry</label><DateInput className={inp} value={(form.labor_card_expiry as string) ?? ''} onChange={(v) => setForm(p => ({ ...p, labor_card_expiry: v }))} /></div>
            <div className={fld}><label className={lbl}>MOL Number</label><input className={inp} value={form.mol_number as string} onChange={f('mol_number')} /></div>
            <div className={fld}><label className={lbl}>Sponsor Name</label><input className={inp} value={form.sponsor_name as string} onChange={f('sponsor_name')} /></div>
            <div className={fld}><label className={lbl}>Sponsor ID</label><input className={inp} value={form.sponsor_id as string} onChange={f('sponsor_id')} /></div>
            <div className={fld} style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_citizen as boolean}
                  onChange={e => setForm(p => ({ ...p, is_citizen: e.target.checked }))} />
                <span className={lbl} style={{ margin: 0 }}>UAE Citizen / GCC National</span>
              </label>
            </div>
          </div>
        )}

        {/* ─ Salary ─ */}
        {editSection === 'salary' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            {([
              ['basic_salary',        'Basic Salary'],
              ['housing_allowance',   'Housing Allowance'],
              ['transport_allowance', 'Transport Allowance'],
              ['other_allowances',    'Other Allowances'],
            ] as [string, string][]).map(([key, label]) => (
              <div key={key} className={fld}>
                <label className={lbl}>{label} (AED)</label>
                <input className={inp} type="number" min="0" value={form[key] as string} onChange={f(key)} />
              </div>
            ))}
            {/* Calculated totals — read-only */}
            {(() => {
              const monthly = (
                Number(form.basic_salary        || 0) +
                Number(form.housing_allowance   || 0) +
                Number(form.transport_allowance || 0) +
                Number(form.other_allowances    || 0)
              );
              return (
                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-2)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div style={{ background: 'var(--brand-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Total Monthly Package</div>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-brand)' }}>
                      {monthly.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500 }}>AED</span>
                    </div>
                  </div>
                  <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Annual Package</div>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {(monthly * 12).toLocaleString('en-US', { minimumFractionDigits: 0 })} <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500 }}>AED</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </Drawer>
    </MainLayout>
  );
}
