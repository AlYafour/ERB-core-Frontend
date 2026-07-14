'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFieldsApi, EntityType, CustomFieldValueItem } from '@/lib/api/custom-fields';
import { toast } from '@/lib/hooks/use-toast';

interface Props {
  entityType: EntityType;
  entityBaseUrl: string;   // e.g. '/hr/employees/' or '/projects/' (relative to /api)
  objectId: number;
  readOnly?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  text: 'Text', long_text: 'Long Text', integer: 'Integer', decimal: 'Decimal',
  boolean: 'Yes / No', date: 'Date', datetime: 'Date & Time',
  single_choice: 'Choice', multi_choice: 'Multi-Choice',
  email: 'Email', url: 'URL', phone: 'Phone',
};

function InputField({
  item, value, onChange, disabled,
}: {
  item: CustomFieldValueItem;
  value: unknown;
  onChange: (val: unknown) => void;
  disabled: boolean;
}) {
  const { definition } = item;
  const ft = definition.field_type;
  const isDisabled = disabled || definition.is_read_only || !definition.is_active;

  const base: React.CSSProperties = {
    width: '100%', padding: '6px 10px', borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: 13, outline: 'none',
    opacity: isDisabled ? 0.6 : 1, cursor: isDisabled ? 'not-allowed' : 'text',
  };

  if (item.masked) {
    return <input style={base} type="text" value="•••" disabled />;
  }

  if (ft === 'boolean') {
    return (
      <select
        style={{ ...base, cursor: isDisabled ? 'not-allowed' : 'pointer' }}
        value={value == null ? '' : String(value)}
        disabled={isDisabled}
        onChange={e => {
          const v = e.target.value;
          onChange(v === '' ? null : v === 'true');
        }}
      >
        <option value="">— not set —</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (ft === 'single_choice') {
    return (
      <select
        style={{ ...base, cursor: isDisabled ? 'not-allowed' : 'pointer' }}
        value={value == null ? '' : String(value)}
        disabled={isDisabled}
        onChange={e => onChange(e.target.value || null)}
      >
        <option value="">— select —</option>
        {(definition.choices || []).map(c => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>
    );
  }

  if (ft === 'multi_choice') {
    const selected: string[] = Array.isArray(value) ? value as string[] : [];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(definition.choices || []).map(c => (
          <label key={c.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: isDisabled ? 'not-allowed' : 'pointer' }}>
            <input
              type="checkbox"
              disabled={isDisabled}
              checked={selected.includes(c.value)}
              onChange={e => {
                const next = e.target.checked
                  ? [...selected, c.value]
                  : selected.filter(v => v !== c.value);
                onChange(next);
              }}
            />
            {c.label}
          </label>
        ))}
      </div>
    );
  }

  if (ft === 'long_text') {
    return (
      <textarea
        style={{ ...base, minHeight: 72, resize: 'vertical', cursor: isDisabled ? 'not-allowed' : 'text' }}
        value={value == null ? '' : String(value)}
        disabled={isDisabled}
        onChange={e => onChange(e.target.value || null)}
      />
    );
  }

  const inputType = ft === 'date' ? 'date'
    : ft === 'datetime' ? 'datetime-local'
    : ft === 'email' ? 'email'
    : ft === 'url' ? 'url'
    : ft === 'phone' ? 'tel'
    : ft === 'integer' ? 'number'
    : ft === 'decimal' ? 'number'
    : 'text';

  return (
    <input
      style={base}
      type={inputType}
      step={ft === 'decimal' ? 'any' : undefined}
      value={value == null ? '' : String(value)}
      disabled={isDisabled}
      onChange={e => {
        const raw = e.target.value;
        if (raw === '') { onChange(null); return; }
        if (ft === 'integer') { onChange(parseInt(raw, 10)); return; }
        if (ft === 'decimal') { onChange(parseFloat(raw)); return; }
        onChange(raw);
      }}
    />
  );
}

export default function CustomFieldsSection({ entityType, entityBaseUrl, objectId, readOnly = false }: Props) {
  const qc = useQueryClient();
  const [localValues, setLocalValues] = useState<Record<string, unknown>>({});
  const [isDirty, setIsDirty] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['custom-fields', entityType, objectId],
    queryFn: () => customFieldsApi.getEntityValues(entityBaseUrl, objectId),
    enabled: !!objectId,
  });

  // Sync server state → local on first load
  useEffect(() => {
    if (data) {
      const initial: Record<string, unknown> = {};
      for (const item of data.fields) {
        initial[item.definition.key] = item.masked ? null : item.value;
      }
      setLocalValues(initial);
      setIsDirty(false);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      customFieldsApi.setEntityValues(entityBaseUrl, objectId, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields', entityType, objectId] });
      setIsDirty(false);
      toast({ title: 'Custom fields saved', variant: 'success' });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { errors?: Record<string, string[]> } } })
        ?.response?.data?.errors;
      if (msg) {
        const first = Object.entries(msg)[0];
        toast({ title: `${first[0]}: ${first[1][0]}`, variant: 'error' });
      } else {
        toast({ title: 'Failed to save custom fields', variant: 'error' });
      }
    },
  });

  const handleChange = useCallback((key: string, val: unknown) => {
    setLocalValues(prev => ({ ...prev, [key]: val }));
    setIsDirty(true);
  }, []);

  const handleSave = () => {
    mutation.mutate(localValues);
  };

  if (isLoading) return (
    <div style={{ padding: 20, color: 'var(--text-2)', fontSize: 13 }}>Loading custom fields…</div>
  );
  if (error) return (
    <div style={{ padding: 20, color: '#EF4444', fontSize: 13 }}>Failed to load custom fields.</div>
  );
  if (!data || data.fields.length === 0) return (
    <div style={{ padding: 20, color: 'var(--text-2)', fontSize: 13 }}>
      No custom fields defined for this entity type.
    </div>
  );

  const activeFields  = data.fields.filter(f => f.definition.is_active);
  const inactiveFields = data.fields.filter(f => !f.definition.is_active && f.value != null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {activeFields.map(item => (
        <div key={item.definition.key} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
            {item.definition.label}
            {item.definition.is_required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
            {item.definition.is_sensitive && (
              <span style={{ marginLeft: 6, fontSize: 10, color: '#F59E0B', fontWeight: 700 }}>SENSITIVE</span>
            )}
            {item.definition.is_read_only && (
              <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-3)' }}>READ-ONLY</span>
            )}
          </label>
          <InputField
            item={item}
            value={localValues[item.definition.key]}
            onChange={val => handleChange(item.definition.key, val)}
            disabled={readOnly}
          />
          {item.definition.help_text_user && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
              {item.definition.help_text_user}
            </div>
          )}
        </div>
      ))}

      {inactiveFields.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Retired fields (read-only)
          </div>
          {inactiveFields.map(item => (
            <div key={item.definition.key} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', opacity: 0.6 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
                {item.definition.label}
                <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-3)' }}>INACTIVE</span>
              </label>
              <div style={{ fontSize: 13, color: 'var(--text)', padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 6 }}>
                {item.masked ? '•••' : String(item.value ?? '—')}
              </div>
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={handleSave}
            disabled={!isDirty || mutation.isPending}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: isDirty ? 'pointer' : 'not-allowed',
              background: isDirty ? '#2563EB' : 'var(--border)', color: isDirty ? '#fff' : 'var(--text-3)',
              fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            {mutation.isPending ? 'Saving…' : 'Save custom fields'}
          </button>
        </div>
      )}
    </div>
  );
}
