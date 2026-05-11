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

    const inputClass =
      'w-full rounded-md border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400';
    const labelClass = 'block text-sm font-medium mb-1';

    switch (field.type) {
      case 'text':
      case 'email':
        return (
          <div key={fullName} className="mb-4">
            <label className={labelClass} style={{ color: 'var(--text-primary)' }}>
              {field.label}{field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type={field.type}
              className={inputClass}
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
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
          <div key={fullName} className="mb-4">
            <label className={labelClass} style={{ color: 'var(--text-primary)' }}>{field.label}</label>
            <input
              type="date"
              className={inputClass}
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
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
          <div key={fullName} className="mb-4 col-span-2">
            <label className={labelClass} style={{ color: 'var(--text-primary)' }}>{field.label}</label>
            <textarea
              rows={3}
              className={inputClass}
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
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
          <div key={fullName} className="mb-4">
            <label className={labelClass} style={{ color: 'var(--text-primary)' }}>{field.label}</label>
            <select
              className={inputClass}
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
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
          <div key={fullName} className="mb-4">
            <label className={labelClass} style={{ color: 'var(--text-primary)' }}>{field.label}</label>
            {typeof value === 'string' && value && (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-orange-500 underline mb-1"
              >
                View uploaded file
              </a>
            )}
            <input
              type="file"
              className="block w-full text-sm"
              style={{ color: 'var(--text-secondary)' }}
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
          <div key={fullName} className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              id={fullName}
              className="w-4 h-4 accent-orange-500"
              checked={!!value}
              onChange={(e) =>
                prefix !== '' && repeatableIdx !== undefined
                  ? handleRepeatableChange(step.id, repeatableIdx, field.name, e.target.checked)
                  : handleChange(fullName, e.target.checked)
              }
            />
            <label htmlFor={fullName} className="text-sm" style={{ color: 'var(--text-primary)' }}>
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
        <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          {step.label}
        </h3>

        {list.map((_, idx) => (
          <div
            key={idx}
            className="rounded-lg border p-4 mb-4"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {step.label} #{idx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeRepeatableItem(idx)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              {step.fields.map((field) => renderField(field, step.id, idx))}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addRepeatableItem}
          className="w-full rounded-md border-2 border-dashed py-2 text-sm font-medium transition-colors hover:border-orange-400 hover:text-orange-500"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          + Add {step.label}
        </button>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        {step.label}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        {step.fields.map((field) => renderField(field))}
      </div>
    </div>
  );
}
