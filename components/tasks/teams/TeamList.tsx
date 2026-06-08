'use client';

import type { Team } from '@/types';
import { TaskAvatar } from '../shared/TaskAvatar';
import { TeamListSkeleton } from '../shared/Skeletons';
import { BRAND, BRAND_HEX } from '../shared/constants';

interface Props {
  teams: Team[];
  selectedId: number | null;
  isLoading: boolean;
  onSelect: (id: number) => void;
  onCreateClick: () => void;
}

export function TeamList({ teams, selectedId, isLoading, onSelect, onCreateClick }: Props) {
  return (
    <div
      style={{
        width: 290,
        flexShrink: 0,
        borderRight: '1px solid var(--border-subtle)',
        background: 'var(--card-bg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 18px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Teams</h1>
          <button
            onClick={onCreateClick}
            title="Create new team"
            style={{
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 7,
              border: 'none',
              background: BRAND,
              color: '#fff',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: `0 2px 8px ${BRAND_HEX}40`,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {isLoading ? '…' : `${teams.length} team${teams.length !== 1 ? 's' : ''} total`}
        </p>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        {isLoading ? (
          <TeamListSkeleton />
        ) : teams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '44px 16px' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--surface-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.8" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 14 }}>No teams yet</p>
            <button
              onClick={onCreateClick}
              style={{
                padding: '7px 16px',
                borderRadius: 7,
                border: 'none',
                background: BRAND,
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Create First Team
            </button>
          </div>
        ) : (
          teams.map((team) => {
            const isActive = selectedId === team.id;
            return (
              <button
                key={team.id}
                onClick={() => onSelect(team.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '11px 12px',
                  borderRadius: 9,
                  border: isActive ? `1.5px solid ${BRAND_HEX}35` : '1.5px solid transparent',
                  background: isActive ? `${BRAND_HEX}0f` : 'transparent',
                  cursor: 'pointer',
                  marginBottom: 3,
                  transition: 'all 0.12s',
                  display: 'block',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--surface-subtle)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Team icon */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      background: isActive ? `${BRAND_HEX}20` : 'var(--surface-subtle)',
                      border: `1.5px solid ${isActive ? BRAND_HEX + '40' : 'var(--border-subtle)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.15s',
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isActive ? BRAND : 'var(--text-tertiary)'}
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

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? BRAND : 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {team.name}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                      {team.member_count} members · {team.tasks_count} tasks
                    </p>
                  </div>
                </div>

                {/* Member avatars */}
                {(team.members?.length ?? 0) > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginTop: 8,
                      paddingLeft: 46,
                    }}
                  >
                    {(team.members ?? []).slice(0, 5).map((m, i) => (
                      <div
                        key={m.id}
                        style={{
                          marginLeft: i > 0 ? -6 : 0,
                          border: '2px solid var(--card-bg)',
                          borderRadius: '50%',
                          flexShrink: 0,
                        }}
                      >
                        <TaskAvatar
                          name={m.user_detail.full_name}
                          url={m.user_detail.avatar_url}
                          size={20}
                        />
                      </div>
                    ))}
                    {team.member_count > 5 && (
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          marginLeft: -6,
                          background: 'var(--surface-subtle)',
                          border: '2px solid var(--card-bg)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          color: 'var(--text-tertiary)',
                          fontWeight: 700,
                        }}
                      >
                        +{team.member_count - 5}
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
