'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { Button, PageShell, PageHeader } from '@/components/ui';
import apiClient from '@/lib/api/client';
import { toast } from '@/lib/hooks/use-toast';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OperationConfig {
  id?: number;
  operation_label: string;
  team_label: string;
  cost_label: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────

const operationConfigApi = {
  get: async (): Promise<OperationConfig> => {
    const response = await apiClient.get('/tenants/config/');
    return response.data;
  },
  update: async (data: Partial<OperationConfig>): Promise<OperationConfig> => {
    const response = await apiClient.patch('/tenants/config/', data);
    return response.data;
  },
};

// ── Styles ────────────────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--weight-semibold)',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: 'var(--space-1-5)',
};

const FIELD_HINT: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--text-tertiary)',
  margin: 'var(--space-1) 0 0',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LabelsPage() {
  const { hasPermission } = useMyPermissions();
  const canEdit = hasPermission('settings.settings.update');
  const queryClient = useQueryClient();

  const [form, setForm] = useState<OperationConfig>({
    operation_label: 'Operation',
    team_label: 'Team',
    cost_label: 'Cost',
  });
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-operation-config'],
    queryFn: () => operationConfigApi.get(),
    staleTime: 120_000,
  });

  useEffect(() => {
    if (data) {
      setForm({
        operation_label: data.operation_label || 'Operation',
        team_label: data.team_label || 'Team',
        cost_label: data.cost_label || 'Cost',
      });
      setDirty(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<OperationConfig>) => operationConfigApi.update(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['tenant-operation-config'], updated);
      setDirty(false);
      toast('Labels saved', 'success');
    },
    onError: () => toast('Failed to save labels', 'error'),
  });

  const set = (key: keyof OperationConfig, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.operation_label.trim() || !form.team_label.trim() || !form.cost_label.trim()) return;
    saveMutation.mutate(form);
  };

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="System Labels"
          description="Customise how key system entities are labelled for your organisation."
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Settings', href: '/settings/company' },
            { label: 'System Labels' },
          ]}
        />

        {/* Description banner */}
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface-subtle)',
          border: '1px solid var(--border-subtle)',
          marginBottom: 'var(--space-6)',
          maxWidth: 560,
        }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            These labels customise how system entities are called in your tenant. Changes apply to all users immediately after saving.
          </p>
        </div>

        {/* Form card */}
        <div className="card" style={{ padding: 'var(--space-6)', maxWidth: 560 }}>
          {isLoading ? (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>Loading...</p>
          ) : (
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

              {/* Operation label */}
              <div>
                <label style={LABEL_STYLE}>Operation Label</label>
                <input
                  value={form.operation_label}
                  onChange={e => set('operation_label', e.target.value)}
                  placeholder="Operation"
                  disabled={!canEdit}
                  required
                  className="form-input"
                  style={{ width: '100%', fontSize: 'var(--text-sm)', maxWidth: 320 }}
                />
                <p style={FIELD_HINT}>
                  Default: <strong>Operation</strong> — used for project operations and activity types.
                </p>
              </div>

              {/* Team label */}
              <div>
                <label style={LABEL_STYLE}>Team Label</label>
                <input
                  value={form.team_label}
                  onChange={e => set('team_label', e.target.value)}
                  placeholder="Team"
                  disabled={!canEdit}
                  required
                  className="form-input"
                  style={{ width: '100%', fontSize: 'var(--text-sm)', maxWidth: 320 }}
                />
                <p style={FIELD_HINT}>
                  Default: <strong>Team</strong> — used for work team names and team pickers throughout the app.
                </p>
              </div>

              {/* Cost label */}
              <div>
                <label style={LABEL_STYLE}>Cost Label</label>
                <input
                  value={form.cost_label}
                  onChange={e => set('cost_label', e.target.value)}
                  placeholder="Cost"
                  disabled={!canEdit}
                  required
                  className="form-input"
                  style={{ width: '100%', fontSize: 'var(--text-sm)', maxWidth: 320 }}
                />
                <p style={FIELD_HINT}>
                  Default: <strong>Cost</strong> — used for project cost sections and cost summaries.
                </p>
              </div>

              {/* Save row */}
              {canEdit && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                  paddingTop: 'var(--space-4)',
                  borderTop: '1px solid var(--border-subtle)',
                }}>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={saveMutation.isPending || !dirty}
                  >
                    {saveMutation.isPending ? 'Saving...' : 'Save Labels'}
                  </Button>
                  {dirty && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning)' }}>
                      Unsaved changes
                    </span>
                  )}
                </div>
              )}
            </form>
          )}
        </div>
      </PageShell>
    </MainLayout>
  );
}