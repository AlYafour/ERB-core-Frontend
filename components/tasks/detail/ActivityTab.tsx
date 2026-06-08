'use client';

import type { TaskDetail } from '@/types';
import { TaskAvatar } from '../shared/TaskAvatar';
import { fmtDate } from '../shared/constants';

interface Props {
  activities: TaskDetail['activities'];
}

export function ActivityTab({ activities }: Props) {
  if (activities.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', paddingTop: 12, margin: 0 }}>
        No activity yet.
      </p>
    );
  }

  return (
    <div className="activity-list">
      {activities.map((a, i) => (
        <div key={a.id} className="activity-item">
          {i < activities.length - 1 && <div className="activity-connector" />}
          <TaskAvatar name={a.actor_detail.full_name} url={a.actor_detail.avatar_url} size={28} />
          <div style={{ flex: 1 }}>
            <p className="activity-text">
              <strong>{a.actor_detail.full_name}</strong>{' '}
              <span style={{ color: 'var(--text-secondary)' }}>
                {a.action.replace(/_/g, ' ')}
              </span>
              {a.details?.reason && (
                <span style={{ color: 'var(--status-error)' }}> — {a.details.reason}</span>
              )}
            </p>
            <p className="activity-time">{fmtDate(a.created_at, 'dt')}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
