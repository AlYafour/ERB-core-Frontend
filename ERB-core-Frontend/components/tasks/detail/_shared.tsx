'use client';

import { TaskAvatar } from '../shared/TaskAvatar';

export function UserRow({
  name,
  url,
  sub,
}: {
  name: string;
  url?: string | null;
  sub?: string;
}) {
  return (
    <div className="user-row">
      <TaskAvatar name={name} url={url} size={24} />
      <div>
        <p className="user-row__name">{name}</p>
        {sub && <p className="user-row__sub">{sub}</p>}
      </div>
    </div>
  );
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="task-close-btn" aria-label="Close drawer">
      ×
    </button>
  );
}
