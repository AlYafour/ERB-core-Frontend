'use client';

import { FilterField } from './FilterPanel';

interface FilterTagsProps {
  filters: Record<string, any>;
  fields: FilterField[];
  onRemoveFilter: (key: string) => void;
  onClearAll: () => void;
}

export default function FilterTags({ filters, fields, onRemoveFilter, onClearAll }: FilterTagsProps) {
  const activeFilters = Object.entries(filters).filter(([key, value]) => {
    return value !== '' && value !== null && value !== undefined;
  });

  if (activeFilters.length === 0) return null;

  const getFilterLabel = (key: string, value: any): string => {
    const field = fields.find(f => f.name === key || key.startsWith(f.name));
    if (!field) return `${key}: ${value}`;

    // Handle range filters
    if (key.endsWith('_min') || key.endsWith('_max')) {
      const baseName = key.replace(/_min$|_max$/, '');
      const baseField = fields.find(f => f.name === baseName);
      if (baseField) {
        const min = filters[`${baseName}_min`];
        const max = filters[`${baseName}_max`];
        if (min && max) {
          return `${baseField.label}: ${min} - ${max}`;
        } else if (min) {
          return `${baseField.label} ≥ ${min}`;
        } else if (max) {
          return `${baseField.label} ≤ ${max}`;
        }
      }
    }

    // Handle select/boolean fields
    if (field.type === 'select' || field.type === 'boolean') {
      const option = field.options?.find(opt => String(opt.value) === String(value));
      if (option) {
        return `${field.label}: ${option.label}`;
      }
      if (field.type === 'boolean') {
        return `${field.label}: ${value ? 'Yes' : 'No'}`;
      }
    }

    // Handle date fields
    if (field.type === 'date') {
      return `${field.label}: ${new Date(value).toLocaleDateString()}`;
    }

    return `${field.label}: ${value}`;
  };

  // Group range filters together
  const processedKeys = new Set<string>();
  const tags: { key: string; label: string }[] = [];

  activeFilters.forEach(([key, value]) => {
    if (processedKeys.has(key)) return;

    if (key.endsWith('_min') || key.endsWith('_max')) {
      const baseName = key.replace(/_min$|_max$/, '');
      const min = filters[`${baseName}_min`];
      const max = filters[`${baseName}_max`];
      
      if (min || max) {
        processedKeys.add(`${baseName}_min`);
        processedKeys.add(`${baseName}_max`);
        tags.push({
          key: baseName,
          label: getFilterLabel(key, value),
        });
      }
    } else {
      processedKeys.add(key);
      tags.push({
        key,
        label: getFilterLabel(key, value),
      });
    }
  });

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {tags.map((tag) => (
        <span
          key={tag.key}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border"
          style={{ backgroundColor: 'var(--color-wine-50)', color: 'var(--color-wine-500)', borderColor: 'rgba(124,45,58,0.22)' }}
        >
          {tag.label}
          <button
            onClick={() => {
              // Check if it's a range filter
              const field = fields.find(f => f.name === tag.key);
              if (field?.type === 'range') {
                onRemoveFilter(`${tag.key}_min`);
                onRemoveFilter(`${tag.key}_max`);
              } else {
                onRemoveFilter(tag.key);
              }
            }}
            className="rounded-full p-0.5 transition-colors ml-0.5" style={{ '--tw-hover-bg': 'rgba(124,45,58,0.15)' } as any}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(124,45,58,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      {tags.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

