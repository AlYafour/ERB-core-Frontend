'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrEmployeesApi, hrDepartmentsApi, hrPositionsApi } from '@/lib/api/hr';
import { usersApi } from '@/lib/api/users';
import { toast } from '@/lib/hooks/use-toast';
import { Button, TextField } from '@/components/ui';
import FormField from '@/components/ui/FormField';
import Link from 'next/link';

export default function NewEmployeePage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [createdUserId, setCreatedUserId] = useState<number | null>(null);

  const [userForm, setUserForm] = useState({
    first_name: '', last_name: '', username: '', email: '',
    password: '', phone: '', role: 'site_engineer' as const,
  });

  const [empForm, setEmpForm] = useState({
    gender: '', date_of_birth: '', national_id: '', nationality: '',
    employment_type: 'full_time', join_date: new Date().toISOString().split('T')[0],
    department: '', position: '', basic_salary: '0',
    housing_allowance: '0', transport_allowance: '0', other_allowances: '0',
  });

  const { data: depts } = useQuery({ queryKey: ['hr-departments-all'], queryFn: () => hrDepartmentsApi.getAll({ page: 1 }) });
  const { data: positions } = useQuery({ queryKey: ['hr-positions-all'], queryFn: () => hrPositionsApi.getAll({ page: 1 }) });

  const createUserMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: (user) => {
      setCreatedUserId(user.id);
      setStep(2);
    },
    onError: (e: any) => {
      const msg = e?.response?.data ? Object.values(e.response.data).flat().join(', ') : 'Failed to create user account';
      toast(msg, 'error');
    },
  });

  const createEmpMutation = useMutation({
    mutationFn: (data: any) => hrEmployeesApi.create(data),
    onSuccess: (emp) => {
      toast('Employee created successfully', 'success');
      router.push(`/hr/employees/${emp.id}`);
    },
    onError: () => toast('Failed to create employee profile', 'error'),
  });

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.first_name || !userForm.email || !userForm.password) {
      toast('First name, email and password are required', 'error');
      return;
    }
    if (!userForm.username) {
      userForm.username = userForm.email.split('@')[0];
    }
    createUserMutation.mutate(userForm as any);
  };

  const handleEmpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdUserId) return;
    createEmpMutation.mutate({
      user_id: createdUserId,
      ...empForm,
      department: empForm.department || null,
      position: empForm.position || null,
    });
  };

  const fieldClass = 'flex flex-col gap-1';
  const labelClass = 'text-sm font-medium text-foreground';
  const inputClass = 'w-full px-3 py-2 rounded-md border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';
  const selectClass = inputClass;

  return (
    <MainLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/hr/employees">
            <Button variant="ghost" size="sm">← Back</Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">New Employee</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Step {step} of 2 — {step === 1 ? 'Account Information' : 'Employee Profile'}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 items-center">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: s <= step ? 'var(--sidebar-active-bg)' : 'var(--muted)',
                  color: s <= step ? 'var(--sidebar-active-text)' : 'var(--muted-foreground)',
                }}>
                {s < step ? '✓' : s}
              </div>
              <span className="text-sm" style={{ color: s === step ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                {s === 1 ? 'User Account' : 'HR Profile'}
              </span>
              {s < 2 && <div className="w-8 h-px mx-1" style={{ backgroundColor: 'var(--border)' }} />}
            </div>
          ))}
        </div>

        {/* Step 1: User Account */}
        {step === 1 && (
          <form onSubmit={handleUserSubmit} className="card space-y-5">
            <h2 className="text-base font-semibold text-foreground border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              Account Information
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className={fieldClass}>
                <label className={labelClass}>First Name *</label>
                <input className={inputClass} value={userForm.first_name}
                  onChange={e => setUserForm(p => ({ ...p, first_name: e.target.value }))} required />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Last Name</label>
                <input className={inputClass} value={userForm.last_name}
                  onChange={e => setUserForm(p => ({ ...p, last_name: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={fieldClass}>
                <label className={labelClass}>Email *</label>
                <input className={inputClass} type="email" value={userForm.email}
                  onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} required />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Username</label>
                <input className={inputClass} value={userForm.username} placeholder="Auto from email"
                  onChange={e => setUserForm(p => ({ ...p, username: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={fieldClass}>
                <label className={labelClass}>Phone</label>
                <input className={inputClass} type="tel" value={userForm.phone}
                  onChange={e => setUserForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Role</label>
                <select className={selectClass} value={userForm.role}
                  onChange={e => setUserForm(p => ({ ...p, role: e.target.value as any }))}>
                  <option value="site_engineer">Site Engineer</option>
                  <option value="procurement_officer">Procurement Officer</option>
                  <option value="procurement_manager">Procurement Manager</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
            </div>

            <div className={fieldClass}>
              <label className={labelClass}>Password *</label>
              <input className={inputClass} type="password" value={userForm.password}
                onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} required minLength={8} />
              <span className="text-xs text-muted-foreground">Minimum 8 characters</span>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="primary" isLoading={createUserMutation.isPending}>
                {createUserMutation.isPending ? 'Creating...' : 'Next →'}
              </Button>
            </div>
          </form>
        )}

        {/* Step 2: HR Profile */}
        {step === 2 && (
          <form onSubmit={handleEmpSubmit} className="card space-y-5">
            <h2 className="text-base font-semibold text-foreground border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              HR Profile
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className={fieldClass}>
                <label className={labelClass}>Employment Type</label>
                <select className={selectClass} value={empForm.employment_type}
                  onChange={e => setEmpForm(p => ({ ...p, employment_type: e.target.value }))}>
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Gender</label>
                <select className={selectClass} value={empForm.gender}
                  onChange={e => setEmpForm(p => ({ ...p, gender: e.target.value }))}>
                  <option value="">-- Select --</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={fieldClass}>
                <label className={labelClass}>Join Date *</label>
                <input className={inputClass} type="date" value={empForm.join_date}
                  onChange={e => setEmpForm(p => ({ ...p, join_date: e.target.value }))} required />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Date of Birth</label>
                <input className={inputClass} type="date" value={empForm.date_of_birth}
                  onChange={e => setEmpForm(p => ({ ...p, date_of_birth: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={fieldClass}>
                <label className={labelClass}>Department</label>
                <select className={selectClass} value={empForm.department}
                  onChange={e => setEmpForm(p => ({ ...p, department: e.target.value }))}>
                  <option value="">-- None --</option>
                  {depts?.results?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Position</label>
                <select className={selectClass} value={empForm.position}
                  onChange={e => setEmpForm(p => ({ ...p, position: e.target.value }))}>
                  <option value="">-- None --</option>
                  {positions?.results?.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={fieldClass}>
                <label className={labelClass}>National ID</label>
                <input className={inputClass} value={empForm.national_id}
                  onChange={e => setEmpForm(p => ({ ...p, national_id: e.target.value }))} />
              </div>
              <div className={fieldClass}>
                <label className={labelClass}>Nationality</label>
                <input className={inputClass} value={empForm.nationality}
                  onChange={e => setEmpForm(p => ({ ...p, nationality: e.target.value }))} />
              </div>
            </div>

            <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <p className="text-sm font-semibold text-foreground mb-3">Salary (AED / month)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className={fieldClass}>
                  <label className={labelClass}>Basic Salary</label>
                  <input className={inputClass} type="number" min="0" value={empForm.basic_salary}
                    onChange={e => setEmpForm(p => ({ ...p, basic_salary: e.target.value }))} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Housing Allowance</label>
                  <input className={inputClass} type="number" min="0" value={empForm.housing_allowance}
                    onChange={e => setEmpForm(p => ({ ...p, housing_allowance: e.target.value }))} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Transport Allowance</label>
                  <input className={inputClass} type="number" min="0" value={empForm.transport_allowance}
                    onChange={e => setEmpForm(p => ({ ...p, transport_allowance: e.target.value }))} />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Other Allowances</label>
                  <input className={inputClass} type="number" min="0" value={empForm.other_allowances}
                    onChange={e => setEmpForm(p => ({ ...p, other_allowances: e.target.value }))} />
                </div>
              </div>
              <div className="mt-3 p-3 rounded-md" style={{ backgroundColor: 'var(--sidebar-active-bg)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--sidebar-active-text)' }}>
                  Total: AED {(
                    parseFloat(empForm.basic_salary || '0') +
                    parseFloat(empForm.housing_allowance || '0') +
                    parseFloat(empForm.transport_allowance || '0') +
                    parseFloat(empForm.other_allowances || '0')
                  ).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>← Back</Button>
              <Button type="submit" variant="primary" isLoading={createEmpMutation.isPending}>
                {createEmpMutation.isPending ? 'Saving...' : 'Create Employee'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </MainLayout>
  );
}
