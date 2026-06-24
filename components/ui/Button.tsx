'use client';

import { ReactNode } from 'react';
import { BaseButton, BaseButtonProps } from './base/BaseButton';
import { cn } from '@/lib/utils/cn';

// Direct re-export avoids Turbopack TDZ from indirect import→re-export pattern
export { BaseButton as Button } from './base/BaseButton';
export type { BaseButtonProps as ButtonProps } from './base/BaseButton';

export interface IconButtonProps extends Omit<BaseButtonProps, 'children'> {
  icon: ReactNode;
  'aria-label': string;
}

export function IconButton({ icon, className, ...props }: IconButtonProps) {
  return (
    <BaseButton
      variant={props.variant || 'ghost'}
      size={props.size || 'sm'}
      className={cn('p-0 w-9 h-9', className)}
      {...props}
    >
      {icon}
    </BaseButton>
  );
}
