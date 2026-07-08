'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function Card({ children, className, hover, onClick, style }: CardProps) {
  return (
    <div
      className={cn('card', hover && 'card-hover', className)}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
}
