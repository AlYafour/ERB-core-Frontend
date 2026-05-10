'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi } from '@/lib/api/tasks';
import { usersApi } from '@/lib/api/users';
import type { Team, TeamMember, TeamMemberRole } from '@/types';

function Avatar({ name, url, size = 32 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (url) return <img src={url} alt={name} width={size} height={size}
    style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'var(--accent)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700,
    }}>{initials}</div>
  );
}

const ROLE_COLORS: Record<TeamMemberRole, string> = {
  leader:   '#f97316',
  member:   '#3b82f6',
  observer: '#9ca3af',
};

function RoleBadge({ role }: { role: TeamMemberRole }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: ROLE_COLORS[role] + '20', color: ROLE_COLORS[role],
    }}>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
  );
}

// ── Team Card ─────────────────────────────────────────────────────────────────

function TeamCard({ team, selected, onClick }: { team: Team; selected: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--card-bg)', border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 12, padding: '16px', cursor: 'pointer', transition: 'all 0.15s',
      boxShadow: selected ? '0 0 0 3px rgba(249,115,22,0.15)' : 'none',
    }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--accent)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'var(--accent)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0,
        }}>👥</div>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 99 }}>
          {team.tasks_count} active task{team.tasks_count !== 1 ? 's' : ''}
        </span>
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{team.name}</h3>
      {team.description && (
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10, overflow: 'hidden', maxHeight: '2.8em', lineHeight: '1.4em' }}>
          {team.description}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex' }}>
          {team.members.slice(0, 4).map((m, i) => (
            <div key={m.id} style={{ marginLeft: i > 0 ? -8 : 0, border: '2px solid var(--card-bg)', borderRadius: '50%' }}>
              <Avatar name={m.user_detail.full_name} url={m.user_detail.avatar_url} size={26} />
            </div>
          ))}
          {team.member_count > 4 && (
            <div style={{
              width: 26, height: 26, borderRadius: '50%', marginLeft: -8,
              background: 'var(--bg-secondary)', border: '2px solid var(--card-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600,
            }}>+{team.member_count - 4}</div>
          )}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{team.member_count} member{team.member_count !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

// ── Create / Edit Team Drawer ─────────────────────────────────────────────────

function TeamFormDrawer({ team, onClose, onSaved }: {
  team?: Team; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(team?.name || '');
  const [desc, setDesc] = useState(team?.description || '');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => team
      ? teamsApi.update(team.id, { name, description: desc })
      : teamsApi.create({ name, description: desc }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teams'] }); onSaved(); onClose(); },
  });

  const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)',
    fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{team ? 'Edit Team' : 'New Team'}</h2>
          <button onClick={onClose} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: 'none', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18 }}>×</button>
        </div>
        <div style={{ flex: 1, padding: '20px 24px' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Team Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Engineering Team" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional description..." rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending} style={{
            flex: 1, padding: '10px', borderRadius: 8, border: 'none',
            background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            opacity: !name.trim() || mutation.isPending ? 0.6 : 1,
          }}>{mutation.isPending ? 'Saving...' : team ? 'Save Changes' : 'Create Team'}</button>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Member Drawer ─────────────────────────────────────────────────────────

function AddMemberDrawer({ team, onClose }: { team: Team; onClose: () => void }) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<TeamMemberRole>('member');
  const qc = useQueryClient();

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-mini'],
    queryFn: () => usersApi.getAll({ page_size: 200 }).then(r => r.results || []),
  });
  const existingIds = new Set(team.members.map(m => m.user));
  const available = allUsers.filter(u => !existingIds.has(u.id));

  const mutation = useMutation({
    mutationFn: () => teamsApi.addMember(team.id, Number(userId), role),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teams'] }); setUserId(''); },
  });

  const removeMutation = useMutation({
    mutationFn: (uid: number) => teamsApi.removeMember(team.id, uid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });

  const selectStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)',
    fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '100%', maxWidth: 460, background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.15)', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Members — {team.name}</h2>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{team.member_count} member{team.member_count !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: 'none', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18 }}>×</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Add member */}
          <div style={{ padding: '14px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Add Member</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <select value={userId} onChange={e => setUserId(e.target.value)} style={selectStyle}>
                <option value="">Select user</option>
                {available.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
                  </option>
                ))}
              </select>
              <select value={role} onChange={e => setRole(e.target.value as TeamMemberRole)} style={selectStyle}>
                <option value="leader">Leader</option>
                <option value="member">Member</option>
                <option value="observer">Observer</option>
              </select>
            </div>
            <button onClick={() => mutation.mutate()} disabled={!userId || mutation.isPending} style={{
              width: '100%', padding: '8px', borderRadius: 7, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: !userId || mutation.isPending ? 0.6 : 1,
            }}>+ Add to Team</button>
          </div>

          {/* Members list */}
          <div>
            {team.members.map((m: TeamMember) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                borderBottom: '1px solid var(--border)',
              }}>
                <Avatar name={m.user_detail.full_name} url={m.user_detail.avatar_url} size={36} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.user_detail.full_name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>@{m.user_detail.username}</p>
                </div>
                <RoleBadge role={m.role} />
                <button onClick={() => removeMutation.mutate(m.user)} disabled={removeMutation.isPending} style={{
                  width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
                  background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#ef4444',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamsPage() {
  const qc = useQueryClient();
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [memberTeam, setMemberTeam] = useState<Team | null>(null);

  const { data: teams = [], isLoading } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const deleteTeam = useMutation({
    mutationFn: (id: number) => teamsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teams'] }); setSelectedTeam(null); },
  });

  return (
    <MainLayout>
      <div style={{ padding: '20px 24px', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>Teams</h1>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {teams.length} team{teams.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={() => setShowCreate(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', borderRadius: 9, border: 'none',
            background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>+ New Team</button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div className="animate-spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
          </div>
        ) : teams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>No teams yet</p>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>Create a team to collaborate on tasks</p>
            <button onClick={() => setShowCreate(true)} style={{
              padding: '9px 20px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>Create First Team</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {teams.map(team => (
              <div key={team.id}>
                <TeamCard
                  team={team}
                  selected={selectedTeam?.id === team.id}
                  onClick={() => setSelectedTeam(selectedTeam?.id === team.id ? null : team)}
                />
                {selectedTeam?.id === team.id && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => setMemberTeam(team)} style={{
                      flex: 1, padding: '7px', borderRadius: 7, border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    }}>👥 Manage Members</button>
                    <button onClick={() => setEditTeam(team)} style={{
                      padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12,
                    }}>✏️ Edit</button>
                    <button onClick={() => {
                      if (confirm(`Delete team "${team.name}"?`)) deleteTeam.mutate(team.id);
                    }} style={{
                      padding: '7px 14px', borderRadius: 7, border: '1px solid #fecaca',
                      background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 12,
                    }}>🗑️</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <TeamFormDrawer onClose={() => setShowCreate(false)} onSaved={() => {}} />}
      {editTeam && <TeamFormDrawer team={editTeam} onClose={() => setEditTeam(null)} onSaved={() => {}} />}
      {memberTeam && <AddMemberDrawer team={memberTeam} onClose={() => setMemberTeam(null)} />}
    </MainLayout>
  );
}
