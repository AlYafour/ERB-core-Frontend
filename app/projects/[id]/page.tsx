'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/projects';
import { usersApi } from '@/lib/api/users';
import { User } from '@/types';
import { Button, PageHeader, PageShell } from '@/components/ui';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { useT } from '@/lib/i18n/useT';

const statusOptions = [
  { value: 'on_going',   label: 'On Going'   },
  { value: 'completed',  label: 'Completed'  },
  { value: 'on_hold',    label: 'On Hold'    },
  { value: 'cancelled',  label: 'Cancelled'  },
];

const lbl = 'form-label';
const inp = 'form-input';
const fld = 'form-field';

export default function EditProjectPage() {
  const t = useT();
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => projectsApi.getById(id),
  });

  const { data: engineersData } = useQuery({
    queryKey: ['users', 'site_engineers'],
    queryFn: () => usersApi.getAll({ role: 'site_engineer', page_size: 200, is_active: true }),
  });
  const engineers: User[] = engineersData?.results ?? [];

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    name_ar: '',
    location: '',
    contact_person: '',
    mobile_number: '',
    sector: '',
    plot: '',
    project_status: 'on_going' as 'on_going' | 'completed' | 'on_hold' | 'cancelled',
    consultant: '',
    description: '',
    responsible_engineer: null as number | null,
    is_active: true,
  });

  useEffect(() => {
    if (project) {
      setFormData({
        code: project.code || '',
        name: project.name || '',
        name_ar: project.name_ar || '',
        location: project.location || '',
        contact_person: project.contact_person || '',
        mobile_number: project.mobile_number || '',
        sector: project.sector || '',
        plot: project.plot || '',
        project_status: project.project_status || 'on_going',
        consultant: project.consultant || '',
        description: project.description || '',
        responsible_engineer: project.responsible_engineer ?? null,
        is_active: project.is_active ?? true,
      });
    }
  }, [project]);

  const handleEngineerChange = (val: string | number | null) => {
    const id = val ? Number(val) : null;
    const eng = engineers.find(e => e.id === id);
    setFormData(f => ({
      ...f,
      responsible_engineer: id,
      mobile_number: eng?.phone ?? f.mobile_number,
    }));
  };

  const mutation = useMutation({
    mutationFn: (data: typeof formData) => projectsApi.update(id, data),
    onSuccess: () => {
      toast('Project updated successfully!', 'success');
      queryClient.invalidateQueries({ queryKey: ['projects', id] });
      router.push('/projects');
    },
    onError: (error: any) => {
      toast(error?.response?.data?.detail || 'Failed to update project', 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const selectedEngineer = engineers.find(e => e.id === formData.responsible_engineer);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="card empty-state">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('btn', 'loading')}</p>
        </div>
      </MainLayout>
    );
  }

  if (!project) {
    return (
      <MainLayout>
        <div className="card empty-state">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('page', 'projects')} {t('empty', 'notFound')}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={t('page', 'editProject')}
          description={`${project.code} — ${project.name}`}
          breadcrumbs={[{ label: t('page', 'projects'), href: '/projects' }, { label: t('page', 'editProject') }]}
        />

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

          {/* Basic Information */}
          <div className="card">
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-4)', marginTop: 0, color: 'var(--text-primary)' }}>
              {t('section', 'basicInfo')}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
              <div className={fld}>
                <label className={lbl}>{t('field', 'projectCode')} *</label>
                <input type="text" required value={formData.code} className={inp}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
              </div>
              <div className={fld} style={{ gridColumn: 'span 2' }}>
                <label className={lbl}>{t('field', 'projectName')} *</label>
                <input type="text" required value={formData.name} className={inp}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className={fld}>
                <label className={lbl}>{t('field', 'projectNameAr')}</label>
                <input type="text" dir="rtl" value={formData.name_ar} className={inp}
                  placeholder="اسم المشروع بالعربي"
                  onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })} />
              </div>
              <div className={fld} style={{ gridColumn: '1 / -1' }}>
                <label className={lbl}>{t('field', 'location')}</label>
                <input type="text" value={formData.location} className={inp}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
              </div>
              <div className={fld} style={{ gridColumn: '1 / -1' }}>
                <label className={lbl}>{t('field', 'description')}</label>
                <textarea value={formData.description} rows={3} className="form-textarea"
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Responsible Engineer + Contact */}
          <div className="card">
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-1)', marginTop: 0, color: 'var(--text-primary)' }}>
              {t('section', 'contactInfo')}
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', color: 'var(--text-secondary)', marginTop: 0 }}>
              {t('field', 'staffMember')} — {t('role', 'site_engineer')}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>

              {/* Engineer selector */}
              <div className={fld} style={{ gridColumn: '1 / -1' }}>
                <label className={lbl}>{t('role', 'site_engineer')} ({t('misc', 'optional')})</label>
                <SearchableDropdown
                  options={[
                    { value: '', label: `— ${t('misc', 'selectRole')} —` },
                    ...engineers.map(e => ({
                      value: String(e.id),
                      label: `${e.first_name} ${e.last_name}`.trim() || e.username,
                      sublabel: e.phone || '',
                    })),
                  ]}
                  value={formData.responsible_engineer ? String(formData.responsible_engineer) : ''}
                  onChange={handleEngineerChange}
                  placeholder={`${t('misc', 'selectRole')}...`}
                />

                {selectedEngineer && (
                  <div
                    style={{
                      marginTop: 'var(--space-2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--sidebar-active-bg)',
                      border: '1px solid var(--color-primary)',
                    }}
                  >
                    <div
                      style={{
                        width: 32, height: 32, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', flexShrink: 0,
                        background: 'var(--color-primary)', color: '#fff',
                      }}
                    >
                      {(selectedEngineer.first_name?.[0] ?? selectedEngineer.username[0]).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                        {`${selectedEngineer.first_name} ${selectedEngineer.last_name}`.trim() || selectedEngineer.username}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                        {selectedEngineer.job_title || t('role', 'site_engineer')}
                        {selectedEngineer.phone ? ` · ${selectedEngineer.phone}` : ''}
                        {selectedEngineer.email ? ` · ${selectedEngineer.email}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(f => ({ ...f, responsible_engineer: null }))}
                      style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className={fld}>
                <label className={lbl}>{t('field', 'contactPerson')}</label>
                <input type="text" value={formData.contact_person} className={inp}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} />
              </div>

              <div className={fld}>
                <label className={lbl}>{t('field', 'mobileNumber')}</label>
                <input type="text" value={formData.mobile_number} className={inp}
                  onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Project Details */}
          <div className="card">
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-4)', marginTop: 0, color: 'var(--text-primary)' }}>
              {t('section', 'projectDetails')}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
              <div className={fld}>
                <label className={lbl}>{t('field', 'sector')}</label>
                <input type="text" value={formData.sector} className={inp}
                  onChange={(e) => setFormData({ ...formData, sector: e.target.value })} />
              </div>
              <div className={fld}>
                <label className={lbl}>{t('field', 'plot')}</label>
                <input type="text" value={formData.plot} className={inp}
                  onChange={(e) => setFormData({ ...formData, plot: e.target.value })} />
              </div>
              <div className={fld}>
                <label className={lbl}>{t('field', 'consultant')}</label>
                <input type="text" value={formData.consultant} className={inp}
                  onChange={(e) => setFormData({ ...formData, consultant: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="card">
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-4)', marginTop: 0, color: 'var(--text-primary)' }}>
              {t('section', 'status')}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
              <div>
                <SearchableDropdown
                  label={t('field', 'projectStatus')}
                  options={statusOptions}
                  value={formData.project_status}
                  onChange={(val) => setFormData({ ...formData, project_status: val as any })}
                  placeholder="Select Status"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <input type="checkbox" id="is_active" checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  style={{ width: 16, height: 16 }} />
                <label htmlFor="is_active" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                  {t('field', 'isActive')}
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
            <Link href="/projects"><Button variant="secondary">{t('btn', 'cancel')}</Button></Link>
            <Button type="submit" variant="primary" disabled={mutation.isPending} isLoading={mutation.isPending}>
              {t('btn', 'update')}
            </Button>
          </div>
        </form>
      </PageShell>
    </MainLayout>
  );
}
