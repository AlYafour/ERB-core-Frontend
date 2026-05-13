'use client';

import { useState, useEffect } from 'react';
import SearchableDropdown, { DropdownOption } from './SearchableDropdown';

export interface FilterField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'boolean' | 'range';
  options?: { value: string | number; label: string }[];
  placeholder?: string;
  group?: string; // Group name for organizing fields
}

interface FilterPanelProps {
  fields: FilterField[];
  filters: Record<string, any>;
  onFilterChange: (filters: Record<string, any>) => void;
  onReset: () => void;
  saveKey?: string; // Key for saving filters (e.g., 'products', 'suppliers')
}

export default function FilterPanel({ fields, filters, onFilterChange, onReset, saveKey }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<Record<string, any>>(filters);
  const [savedFilterSets, setSavedFilterSets] = useState<Array<{ name: string; filters: Record<string, any> }>>([]);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  useEffect(() => {
    if (saveKey) {
      const saved = localStorage.getItem(`filter_sets_${saveKey}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSavedFilterSets(Array.isArray(parsed) ? parsed : []);
        } catch (e) {
          setSavedFilterSets([]);
        }
      }
    }
  }, [saveKey]);

  const handleFieldChange = (name: string, value: any) => {
    const newFilters = { ...localFilters };
    if (value === '' || value === null || value === undefined) {
      delete newFilters[name];
    } else {
      newFilters[name] = value;
    }
    setLocalFilters(newFilters);
  };

  const handleApply = () => {
    onFilterChange(localFilters);
    setIsOpen(false);
  };

  const handleReset = () => {
    setLocalFilters({});
    onReset();
  };

  const handleSaveFilters = () => {
    if (!saveKey) return;
    const name = prompt('Enter a name for this filter set:');
    if (!name || !name.trim()) return;
    
    const saved = localStorage.getItem(`filter_sets_${saveKey}`);
    const sets = saved ? JSON.parse(saved) : [];
    const newSet = { name: name.trim(), filters: localFilters };
    sets.push(newSet);
    localStorage.setItem(`filter_sets_${saveKey}`, JSON.stringify(sets));
    setSavedFilterSets(sets);
  };

  const handleLoadFilters = (filterSet: { name: string; filters: Record<string, any> }) => {
    setLocalFilters(filterSet.filters);
    onFilterChange(filterSet.filters);
    setIsOpen(false);
  };

  const handleDeleteSavedFilter = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!saveKey) return;
    const saved = localStorage.getItem(`filter_sets_${saveKey}`);
    if (!saved) return;
    
    const sets = JSON.parse(saved).filter((s: any) => s.name !== name);
    localStorage.setItem(`filter_sets_${saveKey}`, JSON.stringify(sets));
    setSavedFilterSets(sets);
  };

  const activeFiltersCount = Object.keys(filters).filter(key => {
    const value = filters[key];
    return value !== '' && value !== null && value !== undefined;
  }).length;

  // Group fields by group name
  const groupedFields = fields.reduce((acc, field) => {
    const group = field.group || 'General';
    if (!acc[group]) acc[group] = [];
    acc[group].push(field);
    return acc;
  }, {} as Record<string, FilterField[]>);

  const groups = Object.keys(groupedFields);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn btn-secondary flex items-center gap-2 relative"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        Filters
        {activeFiltersCount > 0 && (
          <span className="absolute -top-1 -right-1 text-white text-xs font-medium rounded-full w-5 h-5 flex items-center justify-center" style={{ backgroundColor: 'var(--color-wine-500)' }}>
            {activeFiltersCount}
          </span>
        )}
      </button>

      {/* Drawer Overlay */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50 transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Drawer - Bottom Sheet on Mobile, Right Side Drawer on Desktop */}
          <div 
            className="fixed bottom-0 left-0 right-0 lg:bottom-auto lg:left-auto lg:inset-y-0 lg:right-0 w-full lg:w-[420px] border-t lg:border-t-0 lg:border-l z-50 flex flex-col shadow-2xl lg:shadow-[0_0_20px_rgba(0,0,0,0.15)] rounded-t-2xl lg:rounded-none max-h-[90vh] lg:max-h-none filter-drawer-mobile"
            style={{
              backgroundColor: 'var(--card-bg, var(--muted))',
              borderColor: 'var(--border)',
            }}
          >
            {/* Header */}
            <div 
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--input)',
              }}
            >
              <h2 
                className="text-base font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                Advanced Filters
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="transition-colors p-1.5 rounded-md"
                style={{ 
                  color: 'var(--muted-foreground)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--foreground)';
                  e.currentTarget.style.backgroundColor = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--muted-foreground)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {/* Saved Filters */}
              {saveKey && savedFilterSets.length > 0 && (
                <div 
                  className="mb-5 pb-5 border-b"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <label 
                    className="block text-[10px] font-semibold mb-2.5 uppercase tracking-wider"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    Saved Filters
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {savedFilterSets.map((filterSet) => (
                      <div key={filterSet.name} className="relative group">
                        <button
                          onClick={() => handleLoadFilters(filterSet)}
                          className="text-xs px-3 py-1.5 rounded-md border transition-colors"
                          style={{
                            backgroundColor: 'var(--input)',
                            borderColor: 'var(--border)',
                            color: 'var(--foreground)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--accent)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--input)';
                          }}
                        >
                          {filterSet.name}
                        </button>
                        <button
                          onClick={(e) => handleDeleteSavedFilter(filterSet.name, e)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px]"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filter Groups */}
              <div className="space-y-5">
                {groups.map((groupName) => (
                  <div key={groupName} className="space-y-3">
                    <h3 
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      {groupName}
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {groupedFields[groupName].map((field) => (
                        <div key={field.name} className={field.type === 'range' ? 'lg:col-span-2' : ''}>
                          <label 
                            className="block text-xs font-medium mb-1.5"
                            style={{ color: 'var(--foreground)' }}
                          >
                            {field.label}
                          </label>
                          {field.type === 'text' && (
                            <input
                              type="text"
                              value={localFilters[field.name] || ''}
                              onChange={(e) => handleFieldChange(field.name, e.target.value)}
                              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 transition-colors"
                              style={{
                                backgroundColor: 'var(--input)',
                                borderColor: 'var(--border)',
                                color: 'var(--foreground)',
                              }}
                            />
                          )}
                          {field.type === 'number' && (
                            <input
                              type="number"
                              value={localFilters[field.name] || ''}
                              onChange={(e) => handleFieldChange(field.name, e.target.value ? parseFloat(e.target.value) : '')}
                              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 transition-colors"
                              style={{
                                backgroundColor: 'var(--input)',
                                borderColor: 'var(--border)',
                                color: 'var(--foreground)',
                              }}
                            />
                          )}
                          {field.type === 'select' && (
                            <SearchableDropdown
                              options={[
                                { value: '', label: 'All' },
                                ...(field.options?.map((opt) => ({
                                  value: opt.value,
                                  label: opt.label,
                                })) || []),
                              ]}
                              value={localFilters[field.name] || ''}
                              onChange={(val) => handleFieldChange(field.name, val)}
                              placeholder={field.placeholder || 'Select...'}
                              searchPlaceholder="Search..."
                              emptyMessage="No options found"
                              className="w-full"
                            />
                          )}
                          {field.type === 'date' && (
                            <input
                              type="date"
                              value={localFilters[field.name] || ''}
                              onChange={(e) => handleFieldChange(field.name, e.target.value)}
                              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 transition-colors"
                              style={{
                                backgroundColor: 'var(--input)',
                                borderColor: 'var(--border)',
                                color: 'var(--foreground)',
                              }}
                            />
                          )}
                          {field.type === 'boolean' && (
                            <SearchableDropdown
                              options={[
                                { value: '', label: 'All' },
                                { value: 'true', label: 'Yes' },
                                { value: 'false', label: 'No' },
                              ]}
                              value={localFilters[field.name] ?? ''}
                              onChange={(val) => handleFieldChange(field.name, val === '' ? '' : val === 'true')}
                              placeholder="Select..."
                              searchPlaceholder="Search..."
                              emptyMessage="No options found"
                              className="w-full"
                            />
                          )}
                          {field.type === 'range' && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <input
                                  type="number"
                                  value={localFilters[`${field.name}_min`] || ''}
                                  onChange={(e) => handleFieldChange(`${field.name}_min`, e.target.value ? parseFloat(e.target.value) : '')}
                                  placeholder="Min"
                                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 transition-colors"
                                  style={{
                                    backgroundColor: 'var(--input)',
                                    borderColor: 'var(--border)',
                                    color: 'var(--foreground)',
                                  }}
                                />
                              </div>
                              <div>
                                <input
                                  type="number"
                                  value={localFilters[`${field.name}_max`] || ''}
                                  onChange={(e) => handleFieldChange(`${field.name}_max`, e.target.value ? parseFloat(e.target.value) : '')}
                                  placeholder="Max"
                                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 transition-colors"
                                  style={{
                                    backgroundColor: 'var(--input)',
                                    borderColor: 'var(--border)',
                                    color: 'var(--foreground)',
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50">
              {saveKey && (
                <button
                  onClick={handleSaveFilters}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Save
                </button>
              )}
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleApply}
                className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-md transition-colors shadow-sm" style={{ backgroundColor: 'var(--color-wine-500)' }}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
