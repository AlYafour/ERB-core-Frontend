'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from './Button';

interface ActionItem {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: 'view' | 'edit' | 'delete' | 'success' | 'secondary' | 'ghost';
  isLoading?: boolean;
  hidden?: boolean;
  disabled?: boolean;
}

interface TableActionsProps {
  actions?: ActionItem[];
  viewHref?: string;
  editHref?: string;
  onDelete?: () => void;
  isDeleting?: boolean;
  extra?: ReactNode;
}

export default function TableActions({
  actions,
  viewHref,
  editHref,
  onDelete,
  isDeleting,
  extra,
}: TableActionsProps) {
  /* Build from shorthand props if no actions array provided */
  const items: ActionItem[] = actions ?? [
    ...(viewHref  ? [{ label: 'View',   href: viewHref,  variant: 'view'  as const }] : []),
    ...(editHref  ? [{ label: 'Edit',   href: editHref,  variant: 'edit'  as const }] : []),
    ...(onDelete  ? [{ label: 'Delete', onClick: onDelete, variant: 'delete' as const, isLoading: isDeleting }] : []),
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap' }}>
      {items.filter(a => !a.hidden).map((action, i) =>
        action.href ? (
          <Link key={i} href={action.href}>
            <Button variant={action.variant ?? 'secondary'} size="sm" disabled={action.disabled}>
              {action.label}
            </Button>
          </Link>
        ) : (
          <Button
            key={i}
            variant={action.variant ?? 'secondary'}
            size="sm"
            onClick={action.onClick}
            isLoading={action.isLoading}
            disabled={action.disabled}
          >
            {action.label}
          </Button>
        )
      )}
      {extra}
    </div>
  );
}
