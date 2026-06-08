'use client';

import { FormStep, FormField } from './formConfigs/basicFormConfig';
import { SharedOptions } from '@/lib/api/customers';

interface DynamicFormStepProps {
  step: FormStep;
  formData: Record<string, unknown>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  options: Partial<SharedOptions>;
  loadingOptions?: boolean;
}

export default function DynamicFormStep({
  step,
  formData,
  setFormData,
  options,
  loadingOptions,
}: DynamicFormStepProps) {

  const handleChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRepeatableChange = (stepId: string, index: number, fieldName: string, value: unknown) => {
    setFormData((prev) => {
      const list = [...((prev[stepId] as Record<string, unknown>[]) || [])];
      list[index] = { ...(list[index] || {}), [fieldName]: value };
      return { ...prev, [stepId]: list };
    });
  };

  const addRepeatableItem = () => {
    setFormData((prev) => {
      const list = [...((prev[step.id] as Record<string, unknown>[]) || [])];
      list.push({});
      return { ...prev, [step.id]: list };
    });
  };

  const removeRepeatableItem = (index: number) => {
    setFormData((prev) => {
      const list = [...((prev[step.id] as Record<string, unknown>[]) || [])];
      list.splice(index, 1);
      return { ...prev, [step.id]: list };
    });
  };

  const renderField = (field: FormField, prefix = '', repeatableIdx?: number) => {
    const fullName = prefix ? `${prefix}_${field.name}` : field.name;
    const value = prefix !== ''
      ? ((formData[prefix] as Record<string, unknown>[])?.[repeatableIdx ?? 0]?.[field.name] ?? '')
      : (formData[fullName] ?? (field.type === 'checkbox' ? false : ''));

    switch (field.type) {
      case 'text':
      case 'email':
        return (
          <div key={fullName} className="form-field">
            <label className="form-label">
              {field.label}{field.required && <span style={{ color: 'var(--color-error)', marginLeft: 2 }}>*</span>}
            </label>
            <input
              type={field.type}
              className="form-input"
              value={String(value ?? '')}
              onChange={(e) =>
                prefix !== '' && repeatableIdx !== undefined
                  ? handleRepeatableChange(step.id, repeatableIdx, field.name, e.target.value)
                  : handleChange(fullName, e.target.value)
              }
            />
          </div>
        );

      case 'date':
        return (
          <div key={fullName} className="form-field">
            <label className="form-label">{field.label}</label>
            <input
              type="date"
              className="form-input"
              value={String(value ?? '')}
              onChange={(e) =>
                prefix !== '' && repeatableIdx !== undefined
                  ? handleRepeatableChange(step.id, repeatableIdx, field.name, e.target.value)
                  : handleChange(fullName, e.target.value)
              }
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={fullName} className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">{field.label}</label>
            <textarea
              rows={3}
              className="form-textarea"
              value={String(value ?? '')}
              onChange={(e) =>
                prefix !== '' && repeatableIdx !== undefined
                  ? handleRepeatableChange(step.id, repeatableIdx, field.name, e.target.value)
                  : handleChange(fullName, e.target.value)
              }
            />
          </div>
        );

      case 'select': {
        const opts = (field.optionsKey ? (options as Record<string, { value: string | number; label: string }[]>)[field.optionsKey] : field.options) || [];
        return (
          <div key={fullName} className="form-field">
            <label className="form-label">{field.label}</label>
            <select
              className="form-select"
              value={String(value ?? '')}
              disabled={loadingOptions && !!field.optionsKey}
              onChange={(e) =>
                prefix !== '' && repeatableIdx !== undefined
                  ? handleRepeatableChange(step.id, repeatableIdx, field.name, e.target.value)
                  : handleChange(fullName, e.target.value)
              }
            >
              <option value="">— Select —</option>
              {opts.map((o) => (
                <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
              ))}
            </select>
          </div>
        );
      }

      case 'file': {
        const fileName = value instanceof File
          ? (value as File).name
          : (typeof value === 'string' && value ? null : null);
        return (
          <div key={fullName} className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">
              {field.label}{field.required && <span style={{ color: 'var(--color-error)', marginLeft: 2 }}>*</span>}
            </label>
            {typeof value === 'string' && value && (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--brand)', textDecoration: 'underline', marginBottom: 'var(--space-1)' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                View current file
              </a>
            )}
            <label style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-3)',
              border: '1.5px dashed var(--border-default)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              background: 'var(--surface-subtle)',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span style={{ fontSize: 'var(--text-sm)', color: value instanceof File ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                {fileName ?? (typeof value === 'string' && value ? 'Replace file...' : 'Choose file...')}
              </span>
              <input
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    prefix !== '' && repeatableIdx !== undefined
                      ? handleRepeatableChange(step.id, repeatableIdx, field.name, file)
                      : handleChange(fullName, file);
                  }
                }}
              />
            </label>
          </div>
        );
      }

      case 'checkbox':
        return (
          <div key={fullName} className="form-field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 'var(--space-2)' }}>
            <input
              type="checkbox"
              id={fullName}
              style={{ width: 16, height: 16, accentColor: 'var(--brand)', flexShrink: 0, cursor: 'pointer' }}
              checked={!!value}
              onChange={(e) =>
                prefix !== '' && repeatableIdx !== undefined
                  ? handleRepeatableChange(step.id, repeatableIdx, field.name, e.target.checked)
                  : handleChange(fullName, e.target.checked)
              }
            />
            <label htmlFor={fullName} style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', cursor: 'pointer', margin: 0 }}>
              {field.label}
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  if (step.repeatable) {
    const list = (formData[step.id] as Record<string, unknown>[]) || [];
    return (
      <div>
        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-4)', color: 'var(--text-primary)', marginTop: 0 }}>
          {step.label}
        </h3>

        {list.map((_, idx) => (
          <div
            key={idx}
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              padding: 'var(--space-4)',
              marginBottom: 'var(--space-4)',
              background: 'var(--surface-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'var(--brand)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)',
                  flexShrink: 0,
                }}>
                  {idx + 1}
                </div>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                  {step.label} #{idx + 1}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeRepeatableItem(idx)}
                style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}
              >
                Remove
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>
              {step.fields.map((field) => renderField(field, step.id, idx))}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addRepeatableItem}
          style={{
            width: '100%',
            borderRadius: 'var(--radius-lg)',
            border: '1.5px dashed var(--border-default)',
            padding: 'var(--space-3) 0',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--text-secondary)',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add {step.label}
        </button>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-4)', color: 'var(--text-primary)', marginTop: 0 }}>
        {step.label}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>
        {step.fields.map((field) => renderField(field))}
      </div>
    </div>
  );
}
