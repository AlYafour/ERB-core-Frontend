'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi } from '@/lib/api/tasks';
import { usersApi } from '@/lib/api/users';
import type { Team, TeamMember, TeamMemberRole } from '@/types';

const ORANGE = '#F97316';

const ROLE: Record<TeamMemberRole, { label: string; color: string; bg: string }> = {
  leader:   { label: 'Leader',   color: '#D97706', bg: '#FEF3C7' },
  member:   { label: 'Member',   color: '#2563EB', bg: '#DBEAFE' },
  observer: { label: 'Observer', color: '#64748B', bg: '#F1F5F9' },
};

// ─── micro ui ─────────────────────────────────────────────────────────────────

function Av({ name, url, size = 32 }: { name: string; url?: string | null; size?: number }) {
  const i = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return url
    ? <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: ORANGE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, flexShrink: 0 }}>{i}</div>;
}

function RolePill({ role }: { role: TeamMemberRole }) {
  const { label, color, bg } = ROLE[role];
  return <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: bg, color, border: `1px solid ${color}30` }}>{label}</span>;
}

// ─── team form drawer ─────────────────────────────────────────────────────────

function TeamFormDrawer({ team, onClose }: { team?: Team; onClose: () => void }) {
  const [name, setName] = useState(team?.name || '');
  const [desc, setDesc] = useState(team?.description || '');
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () => team ? teamsApi.update(team.id, { name, description: desc }) : teamsApi.create({ name, description: desc }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teams'] }); onClose(); },
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--card-bg)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{team ? 'Edit Team' : 'Create New Team'}</h2>
          <button onClick={onClose} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: '1px solid var(--border-primary)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18 }}>×</button>
        </div>
        <div style={{ padding: '22px 24px' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Team Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Engineering, Operations…"
              autoFocus
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="What does this team do?"
              rows={3} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => mut.mutate()} disabled={!name.trim() || mut.isPending} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: ORANGE, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: !name.trim() || mut.isPending ? 0.6 : 1 }}>
              {mut.isPending ? 'Saving…' : team ? 'Save Changes' : 'Create Team'}
            </button>
            <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── team detail panel ────────────────────────────────────────────────────────

function TeamDetail({ team, onEdit, onDelete }: { team: Team; onEdit: () => void; onDelete: () => void }) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<TeamMemberRole>('member');
  const [adding, setAdding] = useState(false);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-mini'],
    queryFn: () => usersApi.getAll({ page_size: 200 }).then(r => r.results || []),
  });

  const existingIds = new Set(team.members.map(m => m.user));
  const available = allUsers.filter(u => !existingIds.has(u.id));

  const addMember = useMutation({
    mutationFn: () => teamsApi.addMember(team.id, Number(userId), role),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teams'] }); setUserId(''); setAdding(false); },
  });
  const removeMember = useMutation({
    mutationFn: (uid: number) => teamsApi.removeMember(team.id, uid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Team header */}
      <div style={{ padding: '28px 32px 24px', borderBottom: '1px solid var(--border-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: `${ORANGE}18`, border: `1.5px solid ${ORANGE}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{team.name}</h2>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 3 }}>
                {team.member_count} member{team.member_count !== 1 ? 's' : ''} · {team.tasks_count} active task{team.tasks_count !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onEdit} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border-primary)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Edit</button>
            <button onClick={onDelete} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #FECACA', background: '#FEF2F2', color: '#EF4444', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Delete</button>
          </div>
        </div>
        {team.description && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-primary)' }}>{team.description}</p>
        )}
      </div>

      {/* Members */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Members ({team.member_count})</p>
          {available.length > 0 && (
            <button onClick={() => setAdding(!adding)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: `1.5px solid ${adding ? ORANGE : 'var(--border-primary)'}`, background: adding ? '#FFF7ED' : 'transparent', color: adding ? ORANGE : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Member
            </button>
          )}
        </div>

        {adding && (
          <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border-primary)', marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 10 }}>
              <select value={userId} onChange={e => setUserId(e.target.value)} style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--card-bg)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="">Select a user to add…</option>
                {available.map(u => (
                  <option key={u.id} value={u.id}>{u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}</option>
                ))}
              </select>
              <select value={role} onChange={e => setRole(e.target.value as TeamMemberRole)} style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--card-bg)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="leader">Leader</option>
                <option value="member">Member</option>
                <option value="observer">Observer</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => addMember.mutate()} disabled={!userId || addMember.isPending} style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none', background: ORANGE, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !userId ? 0.5 : 1 }}>
                {addMember.isPending ? 'Adding…' : 'Add to Team'}
              </button>
              <button onClick={() => setAdding(false)} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid var(--border-primary)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {team.members.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No members yet</p>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Add members to start collaborating</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {team.members.map((m: TeamMember) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border-primary)', transition: 'background 0.1s', marginBottom: 6 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--card-bg)')}
              >
                <Av name={m.user_detail.full_name} url={m.user_detail.avatar_url} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.user_detail.full_name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>@{m.user_detail.username}</p>
                </div>
                <RolePill role={m.role} />
                <button onClick={() => removeMember.mutate(m.user)} disabled={removeMember.isPending} title="Remove member" style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border-primary)', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#FECACA'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = '#FEF2F2'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function TeamsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Team | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);

  const { data: teams = [], isLoading } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  useEffect(() => {
    if (teams.length > 0 && !selected) setSelected(teams[0]);
  }, [teams]);

  const deleteTeam = useMutation({
    mutationFn: (id: number) => teamsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      setSelected(null);
    },
  });

  const currentTeam = teams.find(t => t.id === selected?.id) || null;

  return (
    <MainLayout>
      <div style={{ display: 'flex', height: 'calc(100vh - 56px)', background: 'var(--bg-secondary)', overflow: 'hidden' }}>

        {/* ── Left Panel: Team List ───────────────────────── */}
        <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--border-primary)', background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid var(--border-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Teams</h1>
              <button onClick={() => setShowCreate(true)} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: 'none', background: ORANGE, color: '#fff', cursor: 'pointer', flexShrink: 0 }} title="New Team">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{teams.length} team{teams.length !== 1 ? 's' : ''} total</p>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                <div className="animate-spin" style={{ width: 24, height: 24, border: '2.5px solid var(--border-primary)', borderTopColor: ORANGE, borderRadius: '50%' }} />
              </div>
            ) : teams.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 12 }}>No teams yet</p>
                <button onClick={() => setShowCreate(true)} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: ORANGE, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Create First Team</button>
              </div>
            ) : (
              teams.map(team => {
                const isActive = selected?.id === team.id;
                return (
                  <button key={team.id} onClick={() => setSelected(team)} style={{
                    width: '100%', textAlign: 'left', padding: '11px 12px', borderRadius: 8, border: 'none',
                    background: isActive ? '#FFF7ED' : 'transparent',
                    cursor: 'pointer', marginBottom: 2, transition: 'background 0.1s', display: 'block',
                    outline: isActive ? `1.5px solid ${ORANGE}30` : 'none',
                  }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: isActive ? `${ORANGE}20` : 'var(--bg-secondary)', border: `1.5px solid ${isActive ? ORANGE + '40' : 'var(--border-primary)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isActive ? ORANGE : 'var(--text-tertiary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? ORANGE : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{team.member_count} members · {team.tasks_count} tasks</p>
                      </div>
                    </div>
                    {/* Avatar row */}
                    {team.members.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', marginTop: 8, paddingLeft: 46, gap: -4 }}>
                        {team.members.slice(0, 5).map((m, i) => (
                          <div key={m.id} style={{ marginLeft: i > 0 ? -6 : 0, border: '2px solid var(--card-bg)', borderRadius: '50%' }}>
                            <Av name={m.user_detail.full_name} url={m.user_detail.avatar_url} size={20} />
                          </div>
                        ))}
                        {team.member_count > 5 && (
                          <div style={{ width: 20, height: 20, borderRadius: '50%', marginLeft: -6, background: 'var(--bg-secondary)', border: '2px solid var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 700 }}>+{team.member_count - 5}</div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right Panel: Team Detail ────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
          {currentTeam ? (
            <TeamDetail
              team={currentTeam}
              onEdit={() => setEditTeam(currentTeam)}
              onDelete={() => {
                if (confirm(`Delete team "${currentTeam.name}"? This cannot be undone.`)) {
                  deleteTeam.mutate(currentTeam.id);
                }
              }}
            />
          ) : !isLoading && teams.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--card-bg)', border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>No teams yet</h2>
              <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 24, textAlign: 'center', maxWidth: 320 }}>Create your first team to start assigning tasks and collaborating with your colleagues.</p>
              <button onClick={() => setShowCreate(true)} style={{ padding: '10px 24px', borderRadius: 9, border: 'none', background: ORANGE, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 10px rgba(249,115,22,0.3)' }}>
                Create First Team
              </button>
            </div>
          ) : !currentTeam && !isLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Select a team to view details</p>
            </div>
          ) : null}
        </div>
      </div>

      {showCreate && <TeamFormDrawer onClose={() => setShowCreate(false)} />}
      {editTeam && <TeamFormDrawer team={editTeam} onClose={() => setEditTeam(null)} />}
    </MainLayout>
  );
}
