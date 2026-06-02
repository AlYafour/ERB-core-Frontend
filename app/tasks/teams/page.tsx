'use client';

import { useState } from 'react';
import { confirm } from '@/lib/hooks/use-toast';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Team } from '@/types';
import { teamsApi } from '@/lib/api/tasks';

import { TeamList } from '@/components/tasks/teams/TeamList';
import { TeamDetail } from '@/components/tasks/teams/TeamDetail';
import { TeamFormModal } from '@/components/tasks/teams/TeamFormModal';
import { BRAND, BRAND_HEX } from '@/components/tasks/shared/constants';

export default function TeamsPage() {
  const qc = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────
  // Store only the ID — never a team object reference that can go stale
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTeamId, setEditTeamId] = useState<number | null>(null);

  // ── Data ───────────────────────────────────────────────────────────
  const { data: teamsRaw, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });
  const teams: Team[] = teamsRaw ?? [];

  // Derive the active team ID — never hold a stale object reference in state
  // Falls back to first team if nothing selected or selected team was deleted
  const resolvedSelectedId: number | null =
    selectedId !== null && teams.some((t) => t.id === selectedId)
      ? selectedId
      : teams.length > 0
        ? teams[0].id
        : null;

  const editTeam = editTeamId !== null ? teams.find((t) => t.id === editTeamId) : undefined;

  const deleteTeam = useMutation({
    mutationFn: (id: number) => teamsApi.delete(id),
    onSuccess: (_, deletedId) => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      // Move selection away from deleted team
      if (selectedId === deletedId) {
        const remaining = teams.filter((t) => t.id !== deletedId);
        setSelectedId(remaining.length > 0 ? remaining[0].id : null);
      }
    },
  });

  async function handleDelete(teamId: number, teamName: string) {
    if (await confirm(`Delete team "${teamName}"?\n\nThis action cannot be undone.`)) {
      deleteTeam.mutate(teamId);
    }
  }

  return (
    <MainLayout>
      <div
        style={{
          display: 'flex',
          height: 'calc(100vh - var(--navbar-height, 60px))',
          background: 'var(--surface-subtle)',
          overflow: 'hidden',
        }}
      >
        {/* ── Left Panel: Team List ──────────────────────────── */}
        <TeamList
          teams={teams}
          selectedId={resolvedSelectedId}
          isLoading={isLoading}
          onSelect={setSelectedId}
          onCreateClick={() => setShowCreate(true)}
        />

        {/* ── Right Panel: Team Detail ───────────────────────── */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--surface-subtle)',
          }}
        >
          {resolvedSelectedId !== null ? (
            <TeamDetail
              key={resolvedSelectedId}
              teamId={resolvedSelectedId}
              onEdit={() => setEditTeamId(resolvedSelectedId)}
              onDelete={() => {
                const team = teams.find((t) => t.id === resolvedSelectedId);
                if (team) handleDelete(team.id, team.name);
              }}
            />
          ) : !isLoading ? (
            <EmptyState onCreateClick={() => setShowCreate(true)} />
          ) : null}
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────── */}
      {showCreate && (
        <TeamFormModal onClose={() => setShowCreate(false)} />
      )}
      {editTeam && (
        <TeamFormModal
          team={editTeam}
          onClose={() => setEditTeamId(null)}
        />
      )}
    </MainLayout>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        padding: 40,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        }}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 10,
        }}
      >
        No teams yet
      </h2>
      <p
        style={{
          fontSize: 14,
          color: 'var(--text-tertiary)',
          marginBottom: 28,
          maxWidth: 360,
          lineHeight: 1.6,
        }}
      >
        Create your first team to start assigning tasks and collaborating with your colleagues.
      </p>
      <button
        onClick={onCreateClick}
        style={{
          padding: '11px 28px',
          borderRadius: 9,
          border: 'none',
          background: BRAND,
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: `0 4px 14px ${BRAND_HEX}40`,
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        Create First Team
      </button>
    </div>
  );
}
