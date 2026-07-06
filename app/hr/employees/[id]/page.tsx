'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrEmployeesApi, hrDepartmentsApi, hrPositionsApi, hrEmployeeGroupsApi } from '@/lib/api/hr';
import { usersApi } from '@/lib/api/users';
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


const TABS = ['Home', 'Profile', 'Account', 'Attendance', 'Requests', 'Documents'];

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

function SectionHead({ title, onEdit, isAdmin }: { title: string; onEdit?: () => void; isAdmin?: boolean }) {
  return (
    <div className="section-head">
      <h3 className="section-head-title">{title}</h3>
      {isAdmin && onEdit && (
        <button onClick={onEdit} className="section-edit-btn">Edit</button>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-3)', background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{acc.bank_name}</span>
                  {acc.is_primary && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-subtle)', borderRadius: 4, padding: '1px 6px' }}>WPS Primary</span>}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                  {acc.account_holder_name}
                  {acc.iban && <span style={{ fontFamily: 'monospace', marginLeft: 8 }}>{acc.iban}</span>}
                  {!acc.iban && acc.account_number && <span style={{ fontFamily: 'monospace', marginLeft: 8 }}>{acc.account_number}</span>}
                </div>
              </div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openEdit(acc)} style={{ fontSize: 'var(--text-xs)', color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => delMut.mutate(acc.id)} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
                </div>
              )}
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
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: emp, isLoading, error } = useQuery<HREmployee>({
    queryKey: ['hr-employee', id],
    queryFn:  () => hrEmployeesApi.getById(Number(id)),
  });

  const isSelf = !!emp && currentUser?.id === emp.user?.id;
  const { data: depts }     = useQuery({ queryKey: ['hr-departments-all'], queryFn: () => hrDepartmentsApi.getAll({ page: 1 }), staleTime: 300_000 });
  const { data: positions } = useQuery({ queryKey: ['hr-positions-all'],   queryFn: () => hrPositionsApi.getAll({ page_size: 200 }), staleTime: 300_000 });
  const { data: groups }    = useQuery({ queryKey: ['hr-employee-groups-all'], queryFn: () => hrEmployeeGroupsApi.getAll(), staleTime: 300_000 });

  const deptOptions     = (depts?.results     ?? []).map((d) => ({ value: d.id, label: d.name }));
  const positionOptions = (positions?.results ?? []).map((p) => ({ value: p.id, label: p.title }));
  const groupOptions    = (groups?.results    ?? []).map((g) => ({ value: g.id, label: g.name }));
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employee', id] });
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      toast('Saved successfully', 'success');
      setEditSection(null);
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      toast(detail ? JSON.stringify(detail) : 'Failed to save', 'error');
    },
  });

  const userUpdateMutation = useMutation({
    mutationFn: (data: Partial<User & { password?: string; avatar?: File; stamp?: File }>) =>
      usersApi.update(emp!.user!.id, {
        ...data,
        ...(avatarFile ? { avatar: avatarFile } : {}),
        ...(stampFile  ? { stamp:  stampFile  } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employee', id] });
      toast('Account updated', 'success');
      setEditSection(null);
      setAvatarFile(null);
      setAvatarPreview(null);
      setStampFile(null);
      setStampPreview(null);
      setChangePassword(false);
    },
    onError: () => toast('Failed to update account', 'error'),
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
      salary_display_name:  emp.salary_display_name || '',
      gender:               emp.gender || '',
      date_of_birth:        emp.date_of_birth || '',
      nationality:          emp.nationality || '',
      home_country:         emp.home_country || '',
      religion:             emp.religion || '',
      national_id:          emp.national_id || '',
      passport_number:      emp.passport_number || '',
      passport_issue_date:  emp.passport_issue_date || '',
      passport_expiry_date: emp.passport_expiry_date || '',
      personal_email:       emp.personal_email || '',
      marital_status:       emp.marital_status || '',
      employment_type:      emp.employment_type || 'full_time',
      join_date:            emp.join_date || '',
      probation_end_date:   emp.probation_end_date || '',
      end_date:             emp.end_date || '',
      department:           emp.department ?? '',
      position:             emp.position ?? '',
      employee_group:       emp.employee_group ?? '',
      is_active:            emp.is_active,
      mobile_number:        emp.mobile_number || '',
      extension_number:     emp.extension_number || '',
      address:              emp.address || '',
      sponsor_name:         emp.sponsor_name || '',
      sponsor_id:           emp.sponsor_id || '',
      labor_card:           emp.labor_card || '',
      labor_card_expiry:    emp.labor_card_expiry || '',
      mol_number:           emp.mol_number || '',
      resident_id:          emp.resident_id || '',
      is_citizen:           emp.is_citizen ?? false,
      basic_salary:         emp.basic_salary || '0',
      housing_allowance:    emp.housing_allowance || '0',
      transport_allowance:  emp.transport_allowance || '0',
      other_allowances:     emp.other_allowances || '0',
      username:             emp.user?.username || '',
      email:                emp.user?.email || '',
      phone:                emp.user?.phone || '',
      first_name:           (emp.full_name || '').split(' ')[0] || '',
      last_name:            (emp.full_name || '').split(' ').slice(-1)[0] || '',
      password:             '',
      password2:            '',
    });
    setEditSection(section);
  };

  const handleSave = () => {
    if (editSection === 'account') {
      if (changePassword) {
        if (!form.password || form.password.length < 8) { toast('Password must be at least 8 characters', 'error'); return; }
        if (form.password !== form.password2) { toast('Passwords do not match', 'error'); return; }
      }
      const accountData: Record<string, unknown> = {
        username: form.username, email: form.email, phone: form.phone,
        first_name: form.first_name, last_name: form.last_name,
      };
      if (changePassword && form.password) accountData.password = form.password;
      userUpdateMutation.mutate(accountData as Partial<User & { password?: string }>);
    } else {
      const d = (v: unknown) => (typeof v === 'string' && !v) ? null : v;
      updateMutation.mutate({
        ...form,
        department:           form.department     || null,
        position:             form.position       || null,
        employee_group:       form.employee_group || null,
        date_of_birth:        d(form.date_of_birth),
        join_date:            d(form.join_date),
        probation_end_date:   d(form.probation_end_date),
        end_date:             d(form.end_date),
        passport_issue_date:  d(form.passport_issue_date),
        passport_expiry_date: d(form.passport_expiry_date),
        labor_card_expiry:    d(form.labor_card_expiry),
      } as Partial<HREmployee>);
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

        {/* ── Employee Profile Hero ── */}
        <div style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          marginBottom: 'var(--space-4)',
          background: 'var(--surface-card)',
        }}>
          {/* Cover band */}
          <div style={{
            height: 56,
            background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-muted) 100%)',
            position: 'relative',
          }}>
            <div style={{ position: 'absolute', top: 10, right: 16, display: 'flex', gap: 6 }}>
              <Badge variant={emp.is_active ? 'success' : 'error'}>{emp.is_active ? 'Active' : 'Inactive'}</Badge>
              <Badge variant="default">{empTypeLabel[emp.employment_type] || emp.employment_type}</Badge>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: 'var(--space-3) var(--space-5) var(--space-4)' }}>

            {/* Main row: [avatar overlapping] [identity] [actions] — fills full width */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              alignItems: 'flex-end',
              gap: 'var(--space-3)',
              marginTop: -36,
            }}>
              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {avatarSrc ? (
                  <img src={avatarSrc} alt={emp.full_name} style={{
                    width: 80, height: 80, borderRadius: '50%', objectFit: 'cover',
                    border: '3px solid var(--surface-card)',
                    boxShadow: '0 0 0 2px var(--border-subtle), 0 4px 16px rgba(0,0,0,0.12)',
                  }} />
                ) : (
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: 'var(--brand)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.875rem', fontWeight: 700, color: 'var(--primary-foreground)',
                    border: '3px solid var(--surface-card)',
                    boxShadow: '0 0 0 2px var(--border-subtle), 0 4px 16px rgba(0,0,0,0.12)',
                  }}>{avatarLetter}</div>
                )}
                <span style={{
                  position: 'absolute', bottom: 3, right: 3,
                  width: 14, height: 14, borderRadius: '50%',
                  border: '2.5px solid var(--surface-card)',
                  background: emp.is_active ? 'var(--status-success)' : 'var(--status-error)',
                }} />
              </div>

              {/* Identity */}
              <div style={{ paddingBottom: 4, minWidth: 0 }}>
                <h2 style={{
                  fontSize: 'var(--text-xl)', fontWeight: 800,
                  margin: 0, color: 'var(--text-primary)', lineHeight: 1.2,
                  letterSpacing: '-0.02em',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {emp.full_name}
                </h2>
                {(emp.position_title || emp.department_name) && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '3px 0 0' }}>
                    {[emp.position_title, emp.department_name].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>

              {/* Admin actions */}
              {isAdmin && (
                <div style={{ display: 'flex', gap: 8, paddingBottom: 4 }}>
                  <Button variant="secondary" size="sm" onClick={() => openEdit('account')}>Edit Account</Button>
                  <Button
                    variant={emp.is_active ? 'delete' : 'primary'}
                    size="sm"
                    isLoading={updateMutation.isPending}
                    onClick={() => updateMutation.mutate({ is_active: !emp.is_active })}
                  >
                    {emp.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              )}
            </div>

            {/* Meta grid — auto-fill to spread across full width */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '6px 16px',
              marginTop: 'var(--space-3)',
              paddingTop: 'var(--space-3)',
              borderTop: '1px solid var(--border-subtle)',
            }}>
              {([
                { label: 'Employee ID', value: emp.employee_id, mono: true },
                emp.join_date ? { label: 'Hire Date',  value: fmtDate(emp.join_date),        mono: false } : null,
                emp.join_date ? { label: 'Tenure',     value: calcPeriod(emp.join_date),     mono: false } : null,
                emp.user?.email                ? { label: 'Work Email',  value: emp.user.email,                   mono: false } : null,
                (emp.direct_manager_name || emp.direct_manager_detail?.full_name) ? { label: 'Reports To', value: emp.direct_manager_name || emp.direct_manager_detail!.full_name, mono: false } : null,
                emp.employee_group_name        ? { label: 'Group',       value: emp.employee_group_name,          mono: false } : null,
                emp.mobile_number              ? { label: 'Mobile',      value: emp.mobile_number,                mono: false } : null,
              ] as ({ label: string; value: string; mono: boolean } | null)[]).filter(Boolean).map((item) => (
                <div key={item!.label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                    {item!.label}
                  </span>
                  <span style={{
                    fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500,
                    fontFamily: item!.mono ? 'ui-monospace, monospace' : 'inherit',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item!.value}
                  </span>
                </div>
              ))}
            </div>
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
                    <InfoRow label="Username"    value={emp.user?.username} />
                    <InfoRow label="Work Email"  value={emp.user?.email} />
                    <InfoRow label="Phone"       value={emp.user?.phone} />
                    <InfoRow label="Status"      value={emp.is_active ? 'Active' : 'Inactive'} />
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

            {/* ── Stat snapshot ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {([
                { key: 'present',  label: 'Present Days', color: 'var(--status-success)', bg: 'var(--status-success-bg)' },
                { key: 'absent',   label: 'Absent Days',  color: 'var(--status-error)',   bg: 'var(--status-error-bg)'   },
                { key: 'late',     label: 'Late Days',    color: 'var(--status-warning)', bg: 'var(--status-warning-bg)' },
                { key: 'on_leave', label: 'Leave Days',   color: 'var(--status-info)',    bg: 'var(--status-info-bg)'    },
              ] as { key: string; label: string; color: string; bg: string }[]).map(s => (
                <div key={s.key} style={{
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-lg)',
                  background: s.bg,
                  border: `1px solid ${s.color}33`,
                  textAlign: 'center',
                }}>
                  <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: s.color, margin: 0, lineHeight: 1, letterSpacing: '-0.03em' }}>
                    {(summary?.summary as Record<string, number> | undefined)?.[s.key] ?? '—'}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '6px 0 0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 'var(--space-5)', alignItems: 'start' }}>

              {/* ── LEFT COLUMN ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

                {/* Personal Info */}
                <div className="card">
                  <SectionHead title="Personal Info" onEdit={() => openEdit('personal')} isAdmin={isAdmin} />
                  <div className="info-grid">
                    <InfoRow label="Gender"          value={emp.gender ? emp.gender.charAt(0).toUpperCase() + emp.gender.slice(1) : undefined} />
                    <InfoRow label="Nationality"     value={emp.nationality} />
                    <InfoRow label="Birth Date"      value={fmtDate(emp.date_of_birth)} />
                    <InfoRow label="Age"             value={calcAge(emp.date_of_birth)} />
                    <InfoRow label="Marital Status"  value={emp.marital_status ? emp.marital_status.charAt(0).toUpperCase() + emp.marital_status.slice(1) : undefined} />
                    <InfoRow label="National ID"     value={emp.national_id} />
                    <InfoRow label="Home Country"    value={emp.home_country} />
                    <InfoRow label="Religion"        value={emp.religion} />
                    <InfoRow label="Passport No."    value={emp.passport_number} />
                    <InfoRow label="Passport Issue"  value={fmtDate(emp.passport_issue_date)} />
                    <InfoRow label="Passport Expiry" value={fmtDate(emp.passport_expiry_date)} />
                  </div>
                </div>

                {/* Contact Info */}
                <div className="card">
                  <SectionHead title="Contact Info" onEdit={() => openEdit('contact')} isAdmin={isAdmin} />
                  <div className="info-grid">
                    <InfoRow label="Mobile"         value={emp.mobile_number} />
                    <InfoRow label="Extension"      value={emp.extension_number} />
                    <InfoRow label="Personal Email" value={emp.personal_email} />
                    <InfoRow label="Address"        value={emp.address} />
                  </div>
                </div>

                {/* UAE Legal */}
                <div className="card">
                  <SectionHead title="UAE Legal" onEdit={() => openEdit('legal')} isAdmin={isAdmin} />
                  <div className="info-grid">
                    <InfoRow label="Resident ID"       value={emp.resident_id} />
                    <InfoRow label="UAE Citizen"       value={emp.is_citizen ? 'Yes' : 'No'} />
                    <InfoRow label="Labor Card"        value={emp.labor_card} />
                    <InfoRow label="Labor Card Expiry" value={fmtDate(emp.labor_card_expiry)} />
                    <InfoRow label="MOL Number"        value={emp.mol_number} />
                    <InfoRow label="Sponsor Name"      value={emp.sponsor_name} />
                    <InfoRow label="Sponsor ID"        value={emp.sponsor_id} />
                  </div>
                </div>

                {/* Emergency Contact */}
                {emp.emergency_contact && (
                  <div className="card">
                    <SectionHead title="Emergency Contact" />
                    <div className="info-grid">
                      <InfoRow label="Name"         value={emp.emergency_contact.name} />
                      <InfoRow label="Relationship" value={emp.emergency_contact.relationship} />
                      <InfoRow label="Phone"        value={emp.emergency_contact.phone} />
                    </div>
                  </div>
                )}

              </div>

              {/* ── RIGHT COLUMN ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

                {/* Professional Info */}
                <div className="card">
                  <SectionHead title="Professional Info" onEdit={() => openEdit('professional')} isAdmin={isAdmin} />
                  <div className="info-grid">
                    <InfoRow label="Job Title"           value={emp.position_title} />
                    <InfoRow label="Department"          value={emp.department_name} />
                    <InfoRow label="Employee Category"      value={emp.employee_group_name} />
                    <InfoRow label="Work Type"           value={empTypeLabel[emp.employment_type] || emp.employment_type} />
                    <InfoRow label="Direct Manager"      value={emp.direct_manager_detail?.full_name ?? emp.direct_manager_name ?? undefined} />
                    <InfoRow label="Hiring Date"         value={fmtDate(emp.join_date)} />
                    <InfoRow label="Employment Period"   value={calcPeriod(emp.join_date)} />
                    <InfoRow label="End of Probation"    value={fmtDate(emp.probation_end_date)} />
                    <InfoRow label="End Date"            value={fmtDate(emp.end_date)} />
                    <InfoRow label="Salary Display Name" value={emp.salary_display_name} />
                  </div>
                </div>

                {/* Salary Package — admin only */}
                {isAdmin && (
                  <div className="card">
                    <SectionHead title="Salary Package" onEdit={() => openEdit('salary')} isAdmin={isAdmin} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
                      {([
                        ['Basic Salary', emp.basic_salary],
                        ['Housing',      emp.housing_allowance],
                        ['Transport',    emp.transport_allowance],
                        ['Other',        emp.other_allowances],
                      ] as [string, string | undefined][]).map(([label, val]) => (
                        <div key={label} style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', textAlign: 'center' }}>
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>{label}</p>
                          <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', lineHeight: 1 }}>
                            {Number(val).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                          </p>
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>AED</p>
                        </div>
                      ))}
                    </div>
                    {/* Total Package */}
                    <div style={{
                      marginTop: 'var(--space-4)',
                      padding: 'var(--space-4)',
                      background: 'var(--brand-subtle)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'var(--weight-semibold)', marginBottom: 4 }}>
                          Total Monthly Package
                        </div>
                        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-brand)', lineHeight: 1 }}>
                          {Number(emp.total_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--text-secondary)', marginLeft: 6 }}>AED</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Annual</div>
                        <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)' }}>
                          {(Number(emp.total_salary) * 12).toLocaleString('en-US', { minimumFractionDigits: 0 })} AED
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Bank Accounts — full width below columns */}
            <BankAccountsSection empId={emp.id} isAdmin={isAdmin} />
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
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" className="av" style={{ width: 56, height: 56 }} />
                ) : (
                  <div className="av-initials" style={{ width: 56, height: 56, fontSize: '1.25rem' }}>{avatarLetter}</div>
                )}
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
                    {avatarSrc ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
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
              <div className={fld}><label className={lbl}>First Name</label><input className={inp} value={form.first_name} onChange={f('first_name')} /></div>
              <div className={fld}><label className={lbl}>Last Name</label><input className={inp} value={form.last_name} onChange={f('last_name')} /></div>
              <div className={fld}><label className={lbl}>Username</label><input className={inp} value={form.username} onChange={f('username')} /></div>
              <div className={fld}><label className={lbl}>Email</label><input className={inp} type="email" value={form.email} onChange={f('email')} /></div>
              <div className={fld}><label className={lbl}>Phone</label><input className={inp} type="tel" value={form.phone} onChange={f('phone')} /></div>
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
                  <div className={fld}><label className={lbl}>New Password</label><input className={inp} type="password" placeholder="Min 8 characters" value={form.password} onChange={f('password')} /></div>
                  <div className={fld}><label className={lbl}>Confirm Password</label><input className={inp} type="password" placeholder="Repeat password" value={form.password2} onChange={f('password2')} /></div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─ Personal ─ */}
        {editSection === 'personal' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className={fld}><label className={lbl}>Salary Display Name</label><input className={inp} value={form.salary_display_name} onChange={f('salary_display_name')} /></div>
            <div className={fld}>
              <label className={lbl}>Gender</label>
              <select className={sel} value={form.gender} onChange={f('gender')}>
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className={fld}><label className={lbl}>Date of Birth</label><DateInput className={inp} value={(form.date_of_birth as string) ?? ''} onChange={(v) => setForm(p => ({ ...p, date_of_birth: v }))} /></div>
            <div className={fld}>
              <label className={lbl}>Marital Status</label>
              <select className={sel} value={form.marital_status} onChange={f('marital_status')}>
                <option value="">—</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </div>
            <div className={fld}><label className={lbl}>Nationality</label><input className={inp} value={form.nationality} onChange={f('nationality')} /></div>
            <div className={fld}><label className={lbl}>Home Country</label><input className={inp} value={form.home_country} onChange={f('home_country')} /></div>
            <div className={fld}><label className={lbl}>Religion</label><input className={inp} value={form.religion} onChange={f('religion')} /></div>
            <div className={fld}><label className={lbl}>National ID</label><input className={inp} value={form.national_id} onChange={f('national_id')} /></div>
            <div className={fld}><label className={lbl}>Passport Number</label><input className={inp} value={form.passport_number} onChange={f('passport_number')} /></div>
            <div className={fld}><label className={lbl}>Passport Issue Date</label><DateInput className={inp} value={(form.passport_issue_date as string) ?? ''} onChange={(v) => setForm(p => ({ ...p, passport_issue_date: v }))} /></div>
            <div className={fld}><label className={lbl}>Passport Expiry Date</label><DateInput className={inp} value={(form.passport_expiry_date as string) ?? ''} onChange={(v) => setForm(p => ({ ...p, passport_expiry_date: v }))} /></div>
            <div className={fld}><label className={lbl}>Personal Email</label><input className={inp} type="email" value={form.personal_email} onChange={f('personal_email')} /></div>
          </div>
        )}

        {/* ─ Professional ─ */}
        {editSection === 'professional' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className={fld}>
              <label className={lbl}>Employment Type</label>
              <select className={sel} value={form.employment_type} onChange={f('employment_type')}>
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
            </div>
            <div className={fld}>
              <label className={lbl}>Status</label>
              <select className={sel} value={form.is_active ? 'true' : 'false'}
                onChange={e => setForm(p => ({ ...p, is_active: e.target.value === 'true' }))}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className={fld}>
              <label className={lbl}>Department</label>
              <SearchableDropdown
                options={deptOptions}
                value={form.department ? Number(form.department) : null}
                onChange={(v) => setForm((p) => ({ ...p, department: v ? String(v) : '' }))}
                placeholder="— None —"
                allowClear
                onCreateOption={async (name) => {
                  const dept = await hrDepartmentsApi.create({ name });
                  queryClient.invalidateQueries({ queryKey: ['hr-departments-all'] });
                  toast(`Department "${name}" created`, 'success');
                  return { value: dept.id, label: dept.name };
                }}
              />
            </div>
            <div className={fld}>
              <label className={lbl}>Position</label>
              <SearchableDropdown
                options={positionOptions}
                value={form.position ? Number(form.position) : null}
                onChange={(v) => {
                  const selPos = v ? (positions?.results ?? []).find(p => p.id === Number(v)) : null;
                  setForm((p) => ({
                    ...p,
                    position: v ? String(v) : '',
                    ...(selPos?.department != null ? { department: String(selPos.department) } : {}),
                  }));
                }}
                placeholder="— None —"
                allowClear
                onCreateOption={async (title) => {
                  const pos = await hrPositionsApi.create({ title });
                  queryClient.invalidateQueries({ queryKey: ['hr-positions-all'] });
                  toast(`Position "${title}" created`, 'success');
                  return { value: pos.id, label: pos.title };
                }}
              />
              {(() => {
                const selPos = form.position
                  ? (positions?.results ?? []).find(p => p.id === Number(form.position))
                  : null;
                if (!selPos) return null;
                const hasDept = !!selPos.department_name;
                const hasRole = !!selPos.default_permission_set_name;
                if (!hasDept && !hasRole) return (
                  <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                    No department or role configured — <a href="/hr/positions" style={{ color: 'var(--color-primary-600)', textDecoration: 'underline' }}>set them in Positions</a>
                  </p>
                );
                return (
                  <div style={{ marginTop: 'var(--space-1)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Will auto-assign →</span>
                    {hasDept && (
                      <span style={{ padding: '1px 8px', borderRadius: 'var(--radius-full)', background: 'var(--color-neutral-100, #f3f4f6)', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)' }}>
                        Dept: {selPos.department_name}
                      </span>
                    )}
                    {hasRole && (
                      <span style={{ padding: '1px 8px', borderRadius: 'var(--radius-full)', background: 'var(--color-primary-50, #eff6ff)', color: 'var(--color-primary-700, #1d4ed8)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)' }}>
                        Role: {selPos.default_permission_set_name}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className={fld}>
              <label className={lbl}>Employee Category</label>
              <SearchableDropdown
                options={groupOptions}
                value={form.employee_group ? Number(form.employee_group) : null}
                onChange={(v) => setForm((p) => ({ ...p, employee_group: v ? String(v) : '' }))}
                placeholder="— None —"
                allowClear
                onCreateOption={async (label) => {
                  const code = label.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 20);
                  const g = await hrEmployeeGroupsApi.create({ name: label, name_ar: '', code, description: '', is_active: true });
                  queryClient.invalidateQueries({ queryKey: ['hr-employee-groups-all'] });
                  return { value: g.id, label: g.name };
                }}
              />
            </div>
            <div className={fld}><label className={lbl}>Salary Display Name</label><input className={inp} value={form.salary_display_name} onChange={f('salary_display_name')} /></div>
            <div className={fld}><label className={lbl}>Hiring Date</label><DateInput className={inp} value={(form.join_date as string) ?? ''} onChange={(v) => setForm(p => ({ ...p, join_date: v }))} /></div>
            <div className={fld}><label className={lbl}>End of Probation</label><DateInput className={inp} value={(form.probation_end_date as string) ?? ''} onChange={(v) => setForm(p => ({ ...p, probation_end_date: v }))} /></div>
            <div className={fld}><label className={lbl}>End Date</label><DateInput className={inp} value={(form.end_date as string) ?? ''} onChange={(v) => setForm(p => ({ ...p, end_date: v }))} /></div>
          </div>
        )}

        {/* ─ Contact ─ */}
        {editSection === 'contact' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className={fld}><label className={lbl}>Mobile Number</label><input className={inp} value={form.mobile_number} onChange={f('mobile_number')} /></div>
            <div className={fld}><label className={lbl}>Extension Number</label><input className={inp} value={form.extension_number} onChange={f('extension_number')} /></div>
            <div className={fld} style={{ gridColumn: '1 / -1' }}>
              <label className={lbl}>Address</label>
              <textarea className={ta} rows={3} value={form.address} onChange={f('address')} />
            </div>
            <div className={fld}><label className={lbl}>Personal Email</label><input className={inp} type="email" value={form.personal_email} onChange={f('personal_email')} /></div>
          </div>
        )}

        {/* ─ UAE Legal ─ */}
        {editSection === 'legal' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className={fld}><label className={lbl}>Resident ID</label><input className={inp} value={form.resident_id} onChange={f('resident_id')} /></div>
            <div className={fld}><label className={lbl}>Labor Card</label><input className={inp} value={form.labor_card} onChange={f('labor_card')} /></div>
            <div className={fld}><label className={lbl}>Labor Card Expiry</label><DateInput className={inp} value={(form.labor_card_expiry as string) ?? ''} onChange={(v) => setForm(p => ({ ...p, labor_card_expiry: v }))} /></div>
            <div className={fld}><label className={lbl}>MOL Number</label><input className={inp} value={form.mol_number} onChange={f('mol_number')} /></div>
            <div className={fld}><label className={lbl}>Sponsor Name</label><input className={inp} value={form.sponsor_name} onChange={f('sponsor_name')} /></div>
            <div className={fld}><label className={lbl}>Sponsor ID</label><input className={inp} value={form.sponsor_id} onChange={f('sponsor_id')} /></div>
            <div className={fld} style={{ gridColumn: '1 / -1' }}>
              <label className={lbl}>UAE Citizen?</label>
              <select className={sel} value={form.is_citizen ? 'true' : 'false'}
                onChange={e => setForm(p => ({ ...p, is_citizen: e.target.value === 'true' }))}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
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
                <input className={inp} type="number" min="0" value={form[key]} onChange={f(key)} />
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </MainLayout>
  );
}
