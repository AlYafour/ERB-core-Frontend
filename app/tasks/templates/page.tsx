'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskTemplate, TaskType, TaskPriority } from '@/types';
import { taskTemplatesApi } from '@/lib/api/tasks';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { PRIORITY_CONFIG, TYPE_LABEL } from '@/components/tasks/shared/constants';
import Link from 'next/link';

const EMPTY: Partial<TaskTemplate> = {
  name: '', description: '', task_type: 'task', priority: 'medium',
  requires_approval: true, subtask_titles: [],
};

export default function TaskTemplatesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<TaskTemplate | null>(null);
  const [form, setForm]         = useState<Partial<TaskTemplate>>(EMPTY);
  const [newSubtask, setNewSubtask] = useState('');

  const { data: templates = [], isLoading } = useQuery<TaskTemplate[]>({
    queryKey: ['task-templates'],
    queryFn: taskTemplatesApi.list,
  });

  const saveMutation = useMutation({
    mutationFn: (data: Partial<TaskTemplate>) =>
      editing ? taskTemplatesApi.update(editing.id, data) : taskTemplatesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-templates'] });
      setShowForm(false); setEditing(null); setForm(EMPTY);
      toast(editing ? 'Template updated' : 'Template created', 'success');
    },
    onError: () => toast('Failed to save template', 'error'),
  });

  const delMutation = useMutation({
    mutationFn: (id: number) => taskTemplatesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task-templates'] }),
    onError: () => toast('Failed to delete template', 'error'),
  });

  function openCreate() { setEditing(null); setForm(EMPTY); setShowForm(true); }
  function openEdit(t: TaskTemplate) { setEditing(t); setForm({ ...t }); setShowForm(true); }

  function addSubtask() {
    if (!newSubtask.trim()) return;
    setForm(f => ({ ...f, subtask_titles: [...(f.subtask_titles ?? []), newSubtask.trim()] }));
    setNewSubtask('');
  }

  function removeSubtask(i: number) {
    setForm(f => ({ ...f, subtask_titles: f.subtask_titles?.filter((_, idx) => idx !== i) ?? [] }));
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ marginBottom: 6 }}>
            <Link href="/tasks" style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none' }}>← Tasks</Link>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Task Templates</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Reusable task blueprints for your team</p>
        </div>
        <button onClick={openCreate} className="task-btn task-btn--primary" style={{ padding: '9px 18px' }}>
          + New Template
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ height: 140, background: 'var(--surface-subtle)', borderRadius: 12, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>📋</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>No templates yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 20px' }}>Create reusable task blueprints for your team</p>
          <button onClick={openCreate} className="task-btn task-btn--primary">Create First Template</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {templates.map(t => {
            const pc = PRIORITY_CONFIG[t.priority];
            return (
              <div key={t.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>{t.name}</h3>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => openEdit(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-tertiary)', padding: '2px 4px' }} title="Edit">✏️</button>
                    <button onClick={async () => { if (await confirm('Delete this template?')) delMutation.mutate(t.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-tertiary)', padding: '2px 4px' }} title="Delete">🗑️</button>
                  </div>
                </div>

                {t.description && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{t.description}</p>}

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--surface-subtle)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {TYPE_LABEL[t.task_type]}
                  </span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: pc.bg, color: pc.color, fontWeight: 600 }}>
                    {pc.label}
                  </span>
                  {t.requires_approval && (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: '#EFF6FF', color: '#1D4ED8', fontWeight: 600 }}>Requires Approval</span>
                  )}
                </div>

                {t.subtask_titles.length > 0 && (
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 700 }}>
                      {t.subtask_titles.length} checklist item{t.subtask_titles.length !== 1 ? 's' : ''}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {t.subtask_titles.slice(0, 3).map((s, i) => (
                        <p key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>☐ {s}</p>
                      ))}
                      {t.subtask_titles.length > 3 && (
                        <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: 0 }}>+{t.subtask_titles.length - 3} more items</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); setEditing(null); } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div style={{ background: 'var(--card-bg)', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{editing ? 'Edit Template' : 'New Template'}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-tertiary)' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Template Name *</label>
                <input type="text" value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. New Subcontractor Onboarding" className="task-input" style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Description</label>
                <textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="task-input task-input--textarea" style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Type</label>
                  <select value={form.task_type ?? 'task'} onChange={e => setForm(f => ({ ...f, task_type: e.target.value as TaskType }))} className="task-input" style={{ width: '100%' }}>
                    {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Priority</label>
                  <select value={form.priority ?? 'medium'} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskPriority }))} className="task-input" style={{ width: '100%' }}>
                    {(['critical','high','medium','low'] as const).map(p => <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>)}
                  </select>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.requires_approval ?? true} onChange={e => setForm(f => ({ ...f, requires_approval: e.target.checked }))} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Requires approval</span>
              </label>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Checklist Items</label>
                {(form.subtask_titles ?? []).map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>☐ {s}</span>
                    <button onClick={() => removeSubtask(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 16 }}>×</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input type="text" value={newSubtask} onChange={e => setNewSubtask(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }} placeholder="Add checklist item…" className="task-input" style={{ flex: 1 }} />
                  <button onClick={addSubtask} className="task-btn task-btn--secondary">Add</button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                <button onClick={() => { setShowForm(false); setEditing(null); }} className="task-btn task-btn--secondary">Cancel</button>
                <button
                  onClick={() => { if (form.name?.trim()) saveMutation.mutate(form); }}
                  disabled={!form.name?.trim() || saveMutation.isPending}
                  className="task-btn task-btn--primary"
                  style={{ opacity: form.name?.trim() ? 1 : 0.5 }}
                >
                  {saveMutation.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
