'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/projects';
import { Badge, PageShell } from '@/components/ui';
import { PROJECT_STATUS } from '@/lib/utils/status-colors';
import { PROJECT_LABEL } from '@/lib/constants/status-labels';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import EntityHeader from '@/components/ui/EntityHeader';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';


function Field({ label, value, mono, full }: { label: string; value?: string | null; mono?: boolean; full?: boolean }) {
  return (
    <div className={full ? 'info-full' : undefined}>
      <div className="info-label">{label}</div>
      <div className={mono ? 'info-value-mono' : 'info-value'}>{value || '—'}</div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { user } = useAuth();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;

  const { data: project, isLoading } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => projectsApi.getById(id),
  });

  if (isLoading) {
    return (
      <MainLayout>
        <PageShell>
          <div className="card animate-pulse" style={{ height: 120 }} />
          <div className="card animate-pulse" style={{ height: 280 }} />
        </PageShell>
      </MainLayout>
    );
  }

  if (!project) {
    return (
      <MainLayout>
        <PageShell>
          <div className="card empty-state">
            <p className="empty-state-title">Project not found</p>
          </div>
        </PageShell>
      </MainLayout>
    );
  }

  const fmt = (dt: string) =>
    new Date(dt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <MainLayout>
      <PageShell>
        <EntityHeader
          title={project.name}
          subtitle={project.code}
          image={project.image_url || project.image}
          imageAlt={project.name}
          entityType="project"
          statusBadge={PROJECT_LABEL[project.project_status] || project.project_status}
          statusVariant={PROJECT_STATUS[project.project_status] ?? 'info'}
          backHref="/projects"
          backLabel="Back to Projects"
          actions={
            isAdmin ? (
              <Link href={`/projects/${id}`} className="btn btn-edit">Edit</Link>
            ) : undefined
          }
        />

        <div className="card">
          {/* Project Identity */}
          <div className="info-section-title">Project Details</div>
          <div className="info-grid">
            <Field label="Project Name" value={project.name} />
            <Field label="Project Code" value={project.code} mono />
            <Field label="Location" value={project.location} />
            <Field label="Sector" value={project.sector} />
            <Field label="Plot" value={project.plot} />
            <Field label="Consultant" value={project.consultant} />
          </div>

          {/* Contact */}
          <div className="info-section">
            <div className="info-section-title">Contact</div>
            <div className="info-grid">
              <Field label="Contact Person" value={project.contact_person} />
              <Field label="Mobile" value={project.mobile_number} />
            </div>
          </div>

          {/* Status & Timeline */}
          <div className="info-section">
            <div className="info-section-title">Status & Timeline</div>
            <div className="info-grid">
              <div>
                <div className="info-label">Project Status</div>
                <Badge variant={PROJECT_STATUS[project.project_status] ?? 'info'}>
                  {PROJECT_LABEL[project.project_status] || project.project_status}
                </Badge>
              </div>
              <div>
                <div className="info-label">Active</div>
                <Badge variant={project.is_active ? 'success' : 'error'}>
                  {project.is_active ? 'Yes' : 'No'}
                </Badge>
              </div>
              {project.created_at && <Field label="Created" value={fmt(project.created_at)} />}
              {project.updated_at && <Field label="Last Updated" value={fmt(project.updated_at)} />}
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <div className="info-section">
              <div className="info-section-title">Description</div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
                {project.description}
              </p>
            </div>
          )}
        </div>
      </PageShell>
    </MainLayout>
  );
}
