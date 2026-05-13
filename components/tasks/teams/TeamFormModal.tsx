'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Team } from '@/types';
import { teamsApi } from '@/lib/api/tasks';
import { BRAND } from '../shared/constants';

interface Props {
  team?: Team;
  onClose: () => void;
}

export function TeamFormModal({ team, onClose }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState(team?.name ?? '');
  const [description, setDescription] = useState(team?.description ?? '');

  const save = useMutation({
    mutationFn: () =>
      team
        ? teamsApi.update(team.id, { name: name.trim(), description: description.trim() })
        : teamsApi.create({ name: name.trim(), description: description.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      onClose();
    },
  });

  const canSave = name.trim().length > 0 && !save.isPending;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'var(--card-bg)',
          borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
          overflow: 'hidden',
          animation: 'fadeScaleIn 0.2s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {team ? 'Edit Team' : 'Create New Team'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {team ? 'Update the team details below' : 'Set up a new team for task collaboration'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 7,
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: 18,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 24px' }}>
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 6,
              }}
            >
              Team Name <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engineering, Operations, HR…"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                fontSize: 14,
                background: 'var(--surface-subtle)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = BRAND)}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 6,
              }}
            >
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this team do? (optional)"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                fontSize: 14,
                background: 'var(--surface-subtle)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box',
                lineHeight: 1.5,
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = BRAND)}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => save.mutate()}
              disabled={!canSave}
              style={{
                flex: 1,
                padding: '11px',
                borderRadius: 9,
                border: 'none',
                background: BRAND,
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: canSave ? 'pointer' : 'not-allowed',
                opacity: canSave ? 1 : 0.5,
                transition: 'opacity 0.15s',
              }}
            >
              {save.isPending ? 'Saving…' : team ? 'Save Changes' : 'Create Team'}
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '11px 22px',
                borderRadius: 9,
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
