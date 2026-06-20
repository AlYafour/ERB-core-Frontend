'use client';

import { BaseModal } from '@/components/ui';
import type { EmployeeGroup, HREmployee } from '@/types';

interface Props {
  isOpen:        boolean;
  onClose:       () => void;
  employee:      HREmployee | null;
  label?:        string;
  groups:        EmployeeGroup[];
  currentId:     number | null;
  onAssign:      (groupId: number) => void;
  onClear:       () => void;
  isLoading:     boolean;
}

export function AssignGroupModal({ isOpen, onClose, employee, label, groups, currentId, onAssign, onClear, isLoading }: Props) {
  const active = groups.filter(g => g.is_active);
  const subtitle = employee?.full_name ?? label;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Employee Group"
      size="sm"
    >
      {subtitle && (
        <p className="emp-modal-sub">{subtitle}</p>
      )}

      <div className="emp-grp-grid">
        {active.map(g => {
          const selected = currentId === g.id;
          return (
            <button
              key={g.id}
              disabled={isLoading || selected}
              onClick={() => { onAssign(g.id); }}
              className={`emp-grp-card${selected ? ' emp-grp-card--selected' : ''}`}
            >
              <span className="emp-grp-code">{g.code}</span>
              <span className="emp-grp-name">{g.name}</span>
              {g.name_ar && <span className="emp-grp-name-ar">{g.name_ar}</span>}
              {selected && <span className="emp-grp-check">✓</span>}
            </button>
          );
        })}
      </div>

      {currentId !== null && (
        <button
          className="emp-modal-clear"
          onClick={onClear}
          disabled={isLoading}
        >
          Remove group assignment
        </button>
      )}
    </BaseModal>
  );
}
