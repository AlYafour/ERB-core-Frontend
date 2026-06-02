'use client';

export type Tab = 'checklist' | 'comments' | 'activity' | 'attachments';

interface Props {
  tab: Tab;
  setTab: (t: Tab) => void;
  counts: Record<Tab, number>;
}

const TABS: [Tab, string][] = [
  ['checklist',   'Checklist'],
  ['comments',    'Comments'],
  ['activity',    'Activity'],
  ['attachments', 'Files'],
];

export function TabBar({ tab, setTab, counts }: Props) {
  return (
    <div className="task-tab-bar">
      {TABS.map(([value, label]) => {
        const count = counts[value];
        const active = tab === value;
        return (
          <button
            key={value}
            onClick={() => setTab(value)}
            className="task-tab-btn"
            {...(active ? { 'data-active': '' } : {})}
          >
            {label}
            {count > 0 && (
              <span style={{ marginLeft: 4, opacity: 0.65 }}>({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
