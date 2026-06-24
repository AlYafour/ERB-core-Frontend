'use client';

import { useState } from 'react';
import { BaseModal } from '@/components/ui/base/BaseModal';
import { SearchInput } from '@/components/ui/SearchInput';
import type { HREmployee } from '@/types';

const hasLogin = (e: HREmployee) => !!(e.user?.id);
const canRoute = (e: HREmployee) => hasLogin(e) && e.is_active;

interface Props {
  isOpen:        boolean;
  onClose:       () => void;
  employee:      HREmployee | null;
  label?:        string;
  candidates:    HREmployee[];
  currentMgrId:  number | null;
  onAssign:      (managerId: number) => void;
  onClear:       () => void;
  isLoading:     boolean;
}

export function AssignManagerModal({ isOpen, onClose, employee, label, candidates, currentMgrId, onAssign, onClear, isLoading }: Props) {
  const [search, setSearch] = useState('');
  const subtitle = employee?.full_name ?? label;

  const filtered = candidates.filter(c => {
    if (employee && c.id === employee.id) return false;
    const q = search.toLowerCase();
    return !q || c.full_name.toLowerCase().includes(q) || c.employee_id.toLowerCase().includes(q);
  });

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={() => { setSearch(''); onClose(); }}
      title="Assign Direct Manager"
      size="md"
    >
      {subtitle && (
        <p className="emp-modal-sub">{subtitle}</p>
      )}

      <div style={{ marginBottom: 'var(--space-3)' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or ID…" width="100%" />
      </div>

      {candidates.length === 0 && (
        <div className="emp-mgr-no-managers">
          <p>No employees are designated as managers yet.</p>
          <p>Use the <strong>Mgr</strong> toggle in the employees table to mark who can be assigned as a direct manager.</p>
        </div>
      )}

      {candidates.length > 0 && (
      <div className="emp-mgr-list">
        {filtered.length === 0 ? (
          <p className="emp-mgr-empty">No managers match your search.</p>
        ) : filtered.map(c => {
          const selected = currentMgrId === c.id;
          const routes   = canRoute(c);
          return (
            <button
              key={c.id}
              disabled={isLoading || selected}
              onClick={() => { onAssign(c.id); setSearch(''); }}
              className={`emp-mgr-item${selected ? ' emp-mgr-item--selected' : ''}`}
            >
              <span className={`emp-dot ${routes ? 'emp-dot--green' : 'emp-dot--amber'}`} />
              <span className="emp-mgr-info">
                <span className="emp-mgr-fullname">{c.full_name}</span>
                <span className="emp-mgr-meta">
                  {c.employee_id}{c.position_title ? ` · ${c.position_title}` : ''}
                </span>
              </span>
              {!routes && <span className="emp-no-login-tag">Won't route</span>}
              {selected  && <span className="emp-mgr-current">Current</span>}
            </button>
          );
        })}
      </div>
      )}

      {currentMgrId !== null && (
        <button
          className="emp-modal-clear"
          onClick={() => { setSearch(''); onClear(); }}
          disabled={isLoading}
        >
          Remove manager assignment
        </button>
      )}
    </BaseModal>
  );
}
