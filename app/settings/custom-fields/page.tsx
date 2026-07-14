'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/lib/hooks/use-auth';
import { toast, confirm } from '@/lib/hooks/use-toast';
import {
  customFieldsApi,
  CustomFieldDefinition,
  EntityType,
  FieldType,
  ChoiceOption,
} from '@/lib/api/custom-fields';

// ── Constants ──────────────────────────────────────────────────────────────────

const ENTITY_TABS: { key: EntityType; label: string }[] = [
  { key: 'employee',  label: 'Employees'  },
  { key: 'project',   label: 'Projects'   },
  { key: 'customer',  label: 'Customers'  },
  { key: 'supplier',  label: 'Suppliers'  },
];

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text',          label: 'Text'         },
  { value: 'long_text',     label: 'Long Text'    },
  { value: 'integer',       label: 'Integer'      },
  { value: 'decimal',       label: 'Decimal'      },
  { value: 'boolean',       label: 'Boolean'      },
  { value: 'date',          label: 'Date'         },
  { value: 'datetime',      label: 'Date & Time'  },
  { value: 'single_choice', label: 'Single Choice'},
  { value: 'multi_choice',  label: 'Multi Choice' },
  { value: 'email',         label: 'Email'        },
  { value: 'url',           label: 'URL'          },
  { value: 'phone',         label: 'Phone'        },
];

const CHOICE_TYPES = new Set(['single_choice', 'multi_choice']);

// ── Empty form ─────────────────────────────────────────────────────────────────

function emptyForm(entity_type: EntityType): Partial<CustomFieldDefinition> {
  return {
    entity_type,
    key: '',
    label: '',
    field_type: 'text',
    is_required: false,
    default_value: null,
    help_text_user: '',
    is_active: true,
    order: 0,
    validation_rules: null,
    choices: null,
    is_read_only: false,
    is_sensitive: false,
  };
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', fontSize: 13, outline: 'none',
};

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--text-2)', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 4,
};

const badge = (color: string, bg: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 7px', borderRadius: 99,
  fontSize: 10, fontWeight: 700, color, background: bg,
  textTransform: 'uppercase', letterSpacing: '0.04em',
});

// ── Choice editor ──────────────────────────────────────────────────────────────

function ChoiceEditor({
  choices,
  onChange,
}: {
  choices: ChoiceOption[];
  onChange: (c: ChoiceOption[]) => void;
}) {
  const add = () => onChange([...choices, { value: '', label: '' }]);
  const remove = (i: number) => onChange(choices.filter((_, j) => j !== i));
  const update = (i: number, field: 'value' | 'label', v: string) => {
    const next = [...choices];
    next[i] = { ...next[i], [field]: v };
    onChange(next);
  };

  return (
    <div>
      {choices.map((c, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input
            style={{ ...inp, flex: 1 }}
            placeholder="Value (key)"
            value={c.value}
            onChange={e => update(i, 'value', e.target.value)}
          />
          <input
            style={{ ...inp, flex: 2 }}
            placeholder="Display label"
            value={c.label}
            onChange={e => update(i, 'label', e.target.value)}
          />
          <button
            onClick={() => remove(i)}
            style={{ padding: '0 10px', borderRadius: 6, border: '1px solid #EF4444', color: '#EF4444', background: 'none', cursor: 'pointer', fontSize: 13 }}
          >✕</button>
        </div>
      ))}
      <button
        onClick={add}
        style={{ fontSize: 12, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >+ Add option</button>
    </div>
  );
}

// ── Definition form drawer ─────────────────────────────────────────────────────

function DefinitionForm({
  initial,
  isEdit,
  onSave,
  onCancel,
  saving,
}: {
  initial: Partial<CustomFieldDefinition>;
  isEdit: boolean;
  onSave: (data: Partial<CustomFieldDefinition>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<CustomFieldDefinition>>(initial);
  const set = (field: string, val: unknown) =>
    setForm(prev => ({ ...prev, [field]: val }));

  const needsChoices = CHOICE_TYPES.has(form.field_type ?? '');

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
      background: 'var(--surface)', borderLeft: '1px solid var(--border)',
      boxShadow: '-4px 0 24px rgba(0,0,0,.12)', zIndex: 100,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 15 }}>
        {isEdit ? 'Edit Field Definition' : 'New Field Definition'}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div>
          <label style={lbl}>Key <span style={{ color: '#EF4444' }}>*</span></label>
          <input
            style={{ ...inp, opacity: isEdit ? 0.6 : 1 }}
            value={form.key ?? ''}
            disabled={isEdit}
            placeholder="e.g. cost_center (immutable after creation)"
            onChange={e => set('key', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
          />
        </div>

        <div>
          <label style={lbl}>Label <span style={{ color: '#EF4444' }}>*</span></label>
          <input style={inp} value={form.label ?? ''} placeholder="Displayed to users"
            onChange={e => set('label', e.target.value)} />
        </div>

        <div>
          <label style={lbl}>Field Type <span style={{ color: '#EF4444' }}>*</span> {isEdit && form.field_type && <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--text-3)', marginLeft: 4 }}>(cannot change after values are saved)</span>}</label>
          <select style={inp} value={form.field_type ?? 'text'} onChange={e => set('field_type', e.target.value)}>
            {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {needsChoices && (
          <div>
            <label style={lbl}>Choice Options <span style={{ color: '#EF4444' }}>*</span></label>
            <ChoiceEditor
              choices={form.choices ?? []}
              onChange={c => set('choices', c)}
            />
          </div>
        )}

        <div>
          <label style={lbl}>Help Text</label>
          <input style={inp} value={form.help_text_user ?? ''} placeholder="Optional guidance for users"
            onChange={e => set('help_text_user', e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Display Order</label>
            <input style={inp} type="number" min={0} value={form.order ?? 0}
              onChange={e => set('order', parseInt(e.target.value, 10) || 0)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, paddingTop: 18 }}>
            {([
              ['is_required', 'Required'],
              ['is_active',   'Active'],
              ['is_read_only','Read-only'],
              ['is_sensitive','Sensitive data'],
            ] as [keyof CustomFieldDefinition, string][]).map(([field, label]) => (
              <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form[field]}
                  onChange={e => set(field, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
        </div>

      </div>
      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563EB', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create field'}
        </button>
      </div>
    </div>
  );
}

// ── Definition row ─────────────────────────────────────────────────────────────

function DefinitionRow({
  def,
  onEdit,
  onDelete,
  canManage,
}: {
  def: CustomFieldDefinition;
  onEdit: () => void;
  onDelete: () => void;
  canManage: boolean;
}) {
  const ft = FIELD_TYPES.find(t => t.value === def.field_type);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 32, color: 'var(--text-3)', fontSize: 11, textAlign: 'center' }}>{def.order}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>
          {def.label}
          {def.is_required  && <span style={{ ...badge('#EF4444', '#FEF2F2'), marginLeft: 6 }}>required</span>}
          {def.is_sensitive && <span style={{ ...badge('#F59E0B', '#FFFBEB'), marginLeft: 4 }}>sensitive</span>}
          {def.is_read_only && <span style={{ ...badge('#64748B', '#F1F5F9'), marginLeft: 4 }}>read-only</span>}
          {!def.is_active   && <span style={{ ...badge('#94A3B8', '#F8FAFC'), marginLeft: 4 }}>inactive</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
          key: <code style={{ fontFamily: 'monospace' }}>{def.key}</code>
          {' · '}{ft?.label ?? def.field_type}
          {def.help_text_user && <span style={{ marginLeft: 6 }}>&nbsp;· {def.help_text_user}</span>}
        </div>
      </div>
      {canManage && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onEdit} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>Edit</button>
          <button onClick={onDelete} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #EF4444', background: 'none', color: '#EF4444', fontSize: 12, cursor: 'pointer' }}>Delete</button>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CustomFieldsSettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<EntityType>('employee');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomFieldDefinition | null>(null);

  const canManage = !!(user?.is_company_admin || user?.role === 'admin');

  const { data: defs = [], isLoading } = useQuery({
    queryKey: ['cf-definitions', activeTab],
    queryFn: () => customFieldsApi.listDefinitions({ entity_type: activeTab }),
  });

  const createMut = useMutation({
    mutationFn: (data: Partial<CustomFieldDefinition>) => customFieldsApi.createDefinition(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cf-definitions', activeTab] });
      setShowForm(false);
      toast({ title: 'Field created', variant: 'success' });
    },
    onError: (err: unknown) => {
      const d = (err as { response?: { data?: unknown } })?.response?.data;
      toast({ title: `Error: ${JSON.stringify(d)}`, variant: 'error' });
    },
  });

  const updateMut = useMutation({
    mutationFn: (data: Partial<CustomFieldDefinition>) =>
      customFieldsApi.updateDefinition(editTarget!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cf-definitions', activeTab] });
      setShowForm(false);
      setEditTarget(null);
      toast({ title: 'Field updated', variant: 'success' });
    },
    onError: (err: unknown) => {
      const d = (err as { response?: { data?: unknown } })?.response?.data;
      toast({ title: `Error: ${JSON.stringify(d)}`, variant: 'error' });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => customFieldsApi.deleteDefinition(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cf-definitions', activeTab] });
      toast({ title: 'Field deleted', variant: 'success' });
    },
    onError: (err: unknown) => {
      const d = (err as { response?: { data?: string } })?.response?.data;
      toast({ title: typeof d === 'string' ? d : 'Cannot delete — field has stored values. Deactivate it instead.', variant: 'error' });
    },
  });

  const openCreate = () => { setEditTarget(null); setShowForm(true); };
  const openEdit   = (def: CustomFieldDefinition) => { setEditTarget(def); setShowForm(true); };
  const closeForm  = () => { setShowForm(false); setEditTarget(null); };

  const handleSave = (data: Partial<CustomFieldDefinition>) => {
    if (editTarget) { updateMut.mutate(data); }
    else { createMut.mutate({ ...data, entity_type: activeTab }); }
  };

  const handleDelete = async (def: CustomFieldDefinition) => {
    const ok = await confirm(`Delete field "${def.label}"? This is irreversible if no values exist.`);
    if (!ok) return;
    deleteMut.mutate(def.id);
  };

  return (
    <MainLayout>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Custom Fields</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
            Define additional fields for each entity type. Fields are tenant-specific and validated server-side.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
          {ENTITY_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 18px', border: 'none', background: 'none',
                fontWeight: activeTab === tab.key ? 700 : 400,
                color: activeTab === tab.key ? '#2563EB' : 'var(--text-2)',
                borderBottom: activeTab === tab.key ? '2px solid #2563EB' : '2px solid transparent',
                marginBottom: -2, cursor: 'pointer', fontSize: 13,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Action bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          {canManage && (
            <button
              onClick={openCreate}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563EB', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              + Add field
            </button>
          )}
        </div>

        {/* Definitions list */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: 24, color: 'var(--text-2)', fontSize: 13 }}>Loading…</div>
          ) : defs.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--text-2)', fontSize: 13, textAlign: 'center' }}>
              No custom fields defined for {activeTab}s yet.{' '}
              {canManage && <button onClick={openCreate} style={{ color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Add the first one.</button>}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', padding: '8px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                <div style={{ width: 32 }}>Ord</div>
                <div style={{ flex: 1 }}>Field</div>
                {canManage && <div style={{ width: 120, textAlign: 'right' }}>Actions</div>}
              </div>
              {defs.map(def => (
                <DefinitionRow
                  key={def.id}
                  def={def}
                  onEdit={() => openEdit(def)}
                  onDelete={() => handleDelete(def)}
                  canManage={canManage}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Slide-in form */}
      {showForm && (
        <>
          <div
            onClick={closeForm}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 99 }}
          />
          <DefinitionForm
            initial={editTarget ?? emptyForm(activeTab)}
            isEdit={!!editTarget}
            onSave={handleSave}
            onCancel={closeForm}
            saving={createMut.isPending || updateMut.isPending}
          />
        </>
      )}
    </MainLayout>
  );
}
