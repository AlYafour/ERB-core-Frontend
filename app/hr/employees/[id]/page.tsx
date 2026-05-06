'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrEmployeesApi, hrDepartmentsApi, hrPositionsApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { toast } from '@/lib/hooks/use-toast';
import { Button, Badge, Loader } from '@/components/ui';
import Link from 'next/link';

const employmentTypeLabels: Record<string, string> = {
  full_time: 'Full Time', part_time: 'Part Time', contract: 'Contract', intern: 'Intern',
};

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin' || user?.is_staff || user?.is_superuser;
  const [editing, setEditing] = useState(false);

  const { data: emp, isLoading, error } = useQuery({
    queryKey: ['hr-employee', id],
    queryFn: () => hrEmployeesApi.getById(Number(id)),
  });

  const { data: depts } = useQuery({ queryKey: ['hr-departments-all'], queryFn: () => hrDepartmentsApi.getAll({ page: 1 }) });
  const { data: positions } = useQuery({ queryKey: ['hr-positions-all'], queryFn: () => hrPositionsApi.getAll({ page: 1 }) });
  const { data: summary } = useQuery({
    queryKey: ['hr-emp-summary', id],
    queryFn: () => hrEmployeesApi.getAttendanceSummary(Number(id)),
    enabled: !!id,
  });

  const [form, setForm] = useState<Record<string, any>>({});

  const updateMutation = useMutation({
    mutationFn: (data: any) => hrEmployeesApi.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employee', id] });
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      toast('Employee updated', 'success');
      setEditing(false);
    },
    onError: () => toast('Failed to update employee', 'error'),
  });

  const startEdit = () => {
    if (!emp) return;
    setForm({
      gender: emp.gender || '',
      date_of_birth: emp.date_of_birth || '',
      national_id: emp.national_id || '',
      nationality: emp.nationality || '',
      employment_type: emp.employment_type || 'full_time',
      join_date: emp.join_date || '',
      end_date: emp.end_date || '',
      department: emp.department ?? '',
      position: emp.position ?? '',
      basic_salary: emp.basic_salary || '0',
      housing_allowance: emp.housing_allowance || '0',
      transport_allowance: emp.transport_allowance || '0',
      other_allowances: emp.other_allowances || '0',
      is_active: emp.is_active,
    });
    setEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate({
      ...form,
      department: form.department || null,
      position: form.position || null,
    });
  };

  const inputClass = 'w-full px-3 py-2 rounded-md border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';
  const selectClass = inputClass;
  const fieldClass = 'flex flex-col gap-1';
  const labelClass = 'text-xs font-medium text-muted-foreground uppercase tracking-wide';

  if (isLoading) return <MainLayout><div className="card text-center py-16"><Loader className="mx-auto mb-4" /></div></MainLayout>;
  if (error || !emp) return <MainLayout><div className="card text-center py-16"><p className="text-destructive">Employee not found.</p></div></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-6 max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Link href="/hr/employees"><Button variant="ghost" size="sm">← Back</Button></Link>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{emp.full_name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5 font-mono">{emp.employee_id}</p>
            </div>
          </div>
          {isAdmin && !editing && (
            <Button variant="secondary" onClick={startEdit}>Edit</Button>
          )}
        </div>

        {/* Profile card */}
        <div className="card flex items-center gap-5">
          {emp.avatar ? (
            <img src={emp.avatar} alt="" className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0"
              style={{ backgroundColor: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}>
              {(emp.full_name || '?')[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-lg">{emp.full_name}</p>
            <p className="text-sm text-muted-foreground">{emp.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge className={emp.is_active ? 'badge-success' : 'badge-error'}>
                {emp.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <Badge className="badge-info">{employmentTypeLabels[emp.employment_type] || emp.employment_type}</Badge>
              {emp.department_name && <Badge className="badge-default">{emp.department_name}</Badge>}
              {emp.position_title && <Badge className="badge-default">{emp.position_title}</Badge>}
            </div>
          </div>
        </div>

        {/* Attendance summary */}
        {summary && (
          <div className="grid grid-cols-4 gap-3">
            {(['present', 'absent', 'late', 'on_leave'] as const).map(status => (
              <div key={status} className="card text-center py-3">
                <p className="text-2xl font-bold text-foreground">{summary.summary?.[status] || 0}</p>
                <p className="text-xs text-muted-foreground capitalize mt-1">{status.replace('_', ' ')}</p>
              </div>
            ))}
          </div>
        )}

        {/* View mode */}
        {!editing && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Personal Info</h3>
              {[
                ['Gender', emp.gender || '—'],
                ['Date of Birth', emp.date_of_birth ? new Date(emp.date_of_birth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'],
                ['National ID', emp.national_id || '—'],
                ['Nationality', emp.nationality || '—'],
                ['Join Date', new Date(emp.join_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
                ['End Date', emp.end_date ? new Date(emp.end_date).toLocaleDateString() : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>

            <div className="card space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Salary (AED / month)</h3>
              {[
                ['Basic Salary', emp.basic_salary],
                ['Housing', emp.housing_allowance],
                ['Transport', emp.transport_allowance],
                ['Other', emp.other_allowances],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">
                    {Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-sm border-t pt-3 font-semibold" style={{ borderColor: 'var(--border)' }}>
                <span>Total</span>
                <span style={{ color: 'var(--sidebar-active-text)' }}>
                  {Number(emp.total_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {emp.emergency_contact && (
              <div className="card space-y-3 md:col-span-2">
                <h3 className="text-sm font-semibold text-foreground">Emergency Contact</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><p className="text-muted-foreground">Name</p><p className="font-medium">{emp.emergency_contact.name}</p></div>
                  <div><p className="text-muted-foreground">Relationship</p><p className="font-medium">{emp.emergency_contact.relationship}</p></div>
                  <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{emp.emergency_contact.phone}</p></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit mode */}
        {editing && (
          <div className="card space-y-5">
            <h3 className="text-sm font-semibold text-foreground border-b pb-3" style={{ borderColor: 'var(--border)' }}>Edit Employee</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className={fieldClass}>
                <label className={labelClass}>Employment Type</label>
                <select className={selectClass} value={form.employment_type} onChange={e => setForm(p => ({ ...p, employment_type: e.target.value }))}>
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Status</label>
                <select className={selectClass} value={form.is_active ? 'true' : 'false'} onChange={e => setForm(p => ({ ...p, is_active: e.target.value === 'true' }))}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Gender</label>
                <select className={selectClass} value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}>
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Date of Birth</label>
                <input className={inputClass} type="date" value={form.date_of_birth} onChange={e => setForm(p => ({ ...p, date_of_birth: e.target.value }))} />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Department</label>
                <select className={selectClass} value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
                  <option value="">— None —</option>
                  {depts?.results?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Position</label>
                <select className={selectClass} value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))}>
                  <option value="">— None —</option>
                  {positions?.results?.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>National ID</label>
                <input className={inputClass} value={form.national_id} onChange={e => setForm(p => ({ ...p, national_id: e.target.value }))} />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Nationality</label>
                <input className={inputClass} value={form.nationality} onChange={e => setForm(p => ({ ...p, nationality: e.target.value }))} />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Join Date</label>
                <input className={inputClass} type="date" value={form.join_date} onChange={e => setForm(p => ({ ...p, join_date: e.target.value }))} />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>End Date</label>
                <input className={inputClass} type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
              </div>
            </div>

            <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
              <p className="text-sm font-semibold text-foreground">Salary (AED / month)</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['basic_salary', 'Basic Salary'],
                  ['housing_allowance', 'Housing'],
                  ['transport_allowance', 'Transport'],
                  ['other_allowances', 'Other'],
                ].map(([key, label]) => (
                  <div key={key} className={fieldClass}>
                    <label className={labelClass}>{label}</label>
                    <input className={inputClass} type="number" min="0" value={form[key]}
                      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} isLoading={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
