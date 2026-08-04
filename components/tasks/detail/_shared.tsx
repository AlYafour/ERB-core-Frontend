'use client';

export function UserRow({
  name,
  sub,
}: {
  name: string;
  url?: string | null;
  sub?: string;
}) {
  return (
    <div className="user-row">
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
