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

      case 'file':
        return (
          <div key={fullName} className="form-field">
            <label className="form-label">{field.label}</label>
            {typeof value === 'string' && value && (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--brand)', textDecoration: 'underline', marginBottom: 'var(--space-1)' }}
              >
                View uploaded file
              </a>
            )}
            <input
              type="file"
              className="form-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  prefix !== '' && repeatableIdx !== undefined
                    ? handleRepeatableChange(step.id, repeatableIdx, field.name, file)
                    : handleChange(fullName, file);
                }
              }}
            />
          </div>
        );

      case 'checkbox':
        return (
          <div key={fullName} className="form-field" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
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
            <label htmlFor={fullName} style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', cursor: 'pointer' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--text-secondary)' }}>
                {step.label} #{idx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeRepeatableItem(idx)}
                style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
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
            border: '1.5px dashed var(--border-subtle)',
            padding: 'var(--space-2) 0',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--text-secondary)',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          + Add {step.label}
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
