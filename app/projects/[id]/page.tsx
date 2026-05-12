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
        <div className="card text-center py-12">
          <p style={{ color: 'var(--text-secondary)' }}>{t('btn', 'loading')}</p>
        </div>
      </MainLayout>
    );
  }

  if (!project) {
    return (
      <MainLayout>
        <div className="card text-center py-12">
          <p style={{ color: 'var(--text-secondary)' }}>{t('page', 'projects')} {t('empty', 'notFound')}</p>
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

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Basic Information */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              {t('section', 'basicInfo')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  {t('field', 'projectCode')} *
                </label>
                <input type="text" required value={formData.code} className="input w-full"
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  {t('field', 'projectName')} *
                </label>
                <input type="text" required value={formData.name} className="input w-full"
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  {t('field', 'projectNameAr')}
                </label>
                <input type="text" dir="rtl" value={formData.name_ar} className="input w-full"
                  placeholder="اسم المشروع بالعربي"
                  onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })} />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  {t('field', 'location')}
                </label>
                <input type="text" value={formData.location} className="input w-full"
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  {t('field', 'description')}
                </label>
                <textarea value={formData.description} rows={3} className="input w-full"
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Responsible Engineer + Contact */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              {t('section', 'contactInfo')}
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t('field', 'staffMember')} — {t('role', 'site_engineer')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Engineer selector */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  {t('role', 'site_engineer')} ({t('misc', 'optional')})
                </label>
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

                {/* Selected engineer info card */}
                {selectedEngineer && (
                  <div
                    className="mt-2 flex items-center gap-3 px-3 py-2 rounded-lg"
                    style={{ background: 'var(--sidebar-active-bg)', border: '1px solid var(--color-primary)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: 'var(--color-primary)', color: '#fff' }}
                    >
                      {(selectedEngineer.first_name?.[0] ?? selectedEngineer.username[0]).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {`${selectedEngineer.first_name} ${selectedEngineer.last_name}`.trim() || selectedEngineer.username}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {selectedEngineer.job_title || t('role', 'site_engineer')}
                        {selectedEngineer.phone ? ` · ${selectedEngineer.phone}` : ''}
                        {selectedEngineer.email ? ` · ${selectedEngineer.email}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(f => ({ ...f, responsible_engineer: null }))}
                      className="text-xs px-2 py-1 rounded"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  {t('field', 'contactPerson')}
                </label>
                <input type="text" value={formData.contact_person} className="input w-full"
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  {t('field', 'mobileNumber')}
                </label>
                <input type="text" value={formData.mobile_number} className="input w-full"
                  onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Project Details */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              {t('section', 'projectDetails')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  {t('field', 'sector')}
                </label>
                <input type="text" value={formData.sector} className="input w-full"
                  onChange={(e) => setFormData({ ...formData, sector: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  {t('field', 'plot')}
                </label>
                <input type="text" value={formData.plot} className="input w-full"
                  onChange={(e) => setFormData({ ...formData, plot: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  {t('field', 'consultant')}
                </label>
                <input type="text" value={formData.consultant} className="input w-full"
                  onChange={(e) => setFormData({ ...formData, consultant: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              {t('section', 'status')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <SearchableDropdown
                  label={t('field', 'projectStatus')}
                  options={statusOptions}
                  value={formData.project_status}
                  onChange={(val) => setFormData({ ...formData, project_status: val as any })}
                  placeholder="Select Status"
                />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_active" checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4" />
                <label htmlFor="is_active" className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {t('field', 'isActive')}
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
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
