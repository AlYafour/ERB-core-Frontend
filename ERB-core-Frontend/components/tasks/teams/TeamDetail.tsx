'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Team, TeamMember, TeamMemberRole } from '@/types';
import { teamsApi } from '@/lib/api/tasks';
import { usersApi } from '@/lib/api/users';
import { TaskAvatar } from '../shared/TaskAvatar';
import { BRAND, BRAND_HEX } from '../shared/constants';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';

const ROLE_CONFIG: Record<TeamMemberRole, { label: string; color: string; bg: string }> = {
  leader:   { label: 'Leader',   color: '#D97706', bg: '#FEF3C7' },
  member:   { label: 'Member',   color: '#2563EB', bg: '#DBEAFE' },
  observer: { label: 'Observer', color: '#64748B', bg: '#F1F5F9' },
};

function RolePill({ role }: { role: TeamMemberRole }) {
  const { label, color, bg } = ROLE_CONFIG[role];
  return (
    <span
      style={{
        padding: '3px 10px',
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: bg,
        color,
        border: `1px solid ${color}25`,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

interface Props {
  teamId: number;
  onEdit: () => void;
  onDelete: () => void;
}

export function TeamDetail({ teamId, onEdit, onDelete }: Props) {
  const qc = useQueryClient();
  const [addingMember, setAddingMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<TeamMemberRole>('member');

  // Always fetch fresh team data by ID — avoids stale reference bugs
  const { data: team, isLoading, isError } = useQuery<Team>({
    queryKey: ['team', teamId],
    queryFn: () => teamsApi.getById(teamId),
    retry: 1,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-mini'],
    queryFn: () => usersApi.getAll({ page_size: 200 }).then((r) => r.results || []),
    enabled: addingMember,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['team', teamId] });
    qc.invalidateQueries({ queryKey: ['teams'] });
  }

  const addMember = useMutation({
    mutationFn: () => teamsApi.addMember(teamId, Number(selectedUserId), selectedRole),
    onSuccess: () => {
      setSelectedUserId('');
      setAddingMember(false);
      invalidate();
    },
    onError: (err: unknown) => {
      toast(getApiError(err, 'Failed to add member'), 'error');
    },
  });

  const removeMember = useMutation({
    mutationFn: (userId: number) => teamsApi.removeMember(teamId, userId),
    onSuccess: invalidate,
    onError: (err: unknown) => {
      toast(getApiError(err, 'Failed to remove member'), 'error');
    },
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: string }) =>
      teamsApi.updateMemberRole(teamId, userId, role),
    onSuccess: invalidate,
    onError: (err: unknown) => {
      toast(getApiError(err, 'Failed to update role'), 'error');
    },
  });

  if (isLoading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          color: 'var(--text-tertiary)',
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            border: `2.5px solid var(--border-subtle)`,
            borderTopColor: BRAND,
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }}
        />
        <span style={{ fontSize: 13 }}>Loading team…</span>
      </div>
    );
  }

  if (isError || !team) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: 'var(--text-tertiary)',
          padding: 40,
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          Failed to load team
        </p>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['team', teamId] })}
          style={{
            marginTop: 8,
            padding: '7px 18px',
            borderRadius: 7,
            border: `1px solid ${BRAND_HEX}40`,
            background: `${BRAND_HEX}10`,
            color: BRAND,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const existingIds = new Set((team.members ?? []).map((m) => m.user));
  const availableUsers = allUsers.filter((u) => !existingIds.has(u.id));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Team header */}
      <div
        style={{
          padding: '28px 32px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--card-bg)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: team.description ? 16 : 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 13,
                background: `${BRAND_HEX}15`,
                border: `1.5px solid ${BRAND_HEX}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke={BRAND}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                {team.name}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 3 }}>
                {team.member_count} member{team.member_count !== 1 ? 's' : ''} ·{' '}
                {team.tasks_count} active task{team.tasks_count !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={onEdit}
              style={{
                padding: '7px 16px',
                borderRadius: 7,
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-subtle)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              style={{
                padding: '7px 16px',
                borderRadius: 7,
                border: '1px solid #FECACA',
                background: '#FEF2F2',
                color: '#EF4444',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          </div>
        </div>

        {team.description && (
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.65,
              padding: '12px 16px',
              background: 'var(--surface-subtle)',
              borderRadius: 9,
              border: '1px solid var(--border-subtle)',
            }}
          >
            {team.description}
          </p>
        )}
      </div>

      {/* Members section */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        {/* Members header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            Members ({team.member_count})
          </p>
          <button
            onClick={() => setAddingMember((p) => !p)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 7,
              border: `1.5px solid ${addingMember ? BRAND : 'var(--border-subtle)'}`,
              background: addingMember ? `${BRAND_HEX}12` : 'transparent',
              color: addingMember ? BRAND : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Member
          </button>
        </div>

        {/* Add member form */}
        {addingMember && (
          <div
            style={{
              padding: 16,
              background: 'var(--surface-subtle)',
              borderRadius: 10,
              border: '1px solid var(--border-subtle)',
              marginBottom: 20,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 10,
                marginBottom: 10,
              }}
            >
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                style={{
                  padding: '9px 10px',
                  borderRadius: 7,
                  border: '1px solid var(--border-subtle)',
                  fontSize: 13,
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              >
                <option value="">Select a user to add…</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name && u.last_name
                      ? `${u.first_name} ${u.last_name}`
                      : u.username}
                  </option>
                ))}
              </select>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as TeamMemberRole)}
                style={{
                  padding: '9px 10px',
                  borderRadius: 7,
                  border: '1px solid var(--border-subtle)',
                  fontSize: 13,
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              >
                <option value="leader">Leader</option>
                <option value="member">Member</option>
                <option value="observer">Observer</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => addMember.mutate()}
                disabled={!selectedUserId || addMember.isPending}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: 7,
                  border: 'none',
                  background: BRAND,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: selectedUserId ? 'pointer' : 'not-allowed',
                  opacity: selectedUserId ? 1 : 0.5,
                }}
              >
                {addMember.isPending ? 'Adding…' : 'Add to Team'}
              </button>
              <button
                onClick={() => { setAddingMember(false); setSelectedUserId(''); }}
                style={{
                  padding: '9px 18px',
                  borderRadius: 7,
                  border: '1px solid var(--border-subtle)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Members list */}
        {(team.members?.length ?? 0) === 0 ? (
          <div style={{ textAlign: 'center', padding: '52px 24px' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--surface-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.8" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
              No members yet
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              Add members to start collaborating
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(team.members ?? []).map((m: TeamMember) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-subtle)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-subtle)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--card-bg)')}
              >
                <TaskAvatar
                  name={m.user_detail.full_name}
                  url={m.user_detail.avatar_url}
                  size={38}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.user_detail.full_name}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>
                    @{m.user_detail.username}
                  </p>
                </div>
                <select
                  value={m.role}
                  onChange={(e) => changeRole.mutate({ userId: m.user, role: e.target.value })}
                  disabled={changeRole.isPending}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 7,
                    border: `1px solid ${ROLE_CONFIG[m.role].color}40`,
                    background: ROLE_CONFIG[m.role].bg,
                    color: ROLE_CONFIG[m.role].color,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none',
                    flexShrink: 0,
                  }}
                >
                  <option value="leader">Leader</option>
                  <option value="member">Member</option>
                  <option value="observer">Observer</option>
                </select>
                <button
                  onClick={() => removeMember.mutate(m.user)}
                  disabled={removeMember.isPending}
                  title="Remove from team"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 7,
                    border: '1px solid var(--border-subtle)',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 14,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#FECACA';
                    e.currentTarget.style.color = '#EF4444';
                    e.currentTarget.style.background = '#FEF2F2';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.color = 'var(--text-tertiary)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
