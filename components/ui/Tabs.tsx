'use client';

import { ReactNode, useState, createContext, useContext } from 'react';
import { cn } from '@/lib/utils/cn';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
  variant: 'underline' | 'pills';
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs components must be used within <Tabs>');
  return ctx;
}

export interface TabsProps {
  defaultValue: string;
  children: ReactNode;
  className?: string;
  variant?: 'underline' | 'pills';
}

export function Tabs({ defaultValue, children, className, variant = 'underline' }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, variant }}>
      <div className={cn('w-full', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  const { variant } = useTabsContext();

  if (variant === 'pills') {
    return (
      <div
        role="tablist"
        className={cn('inline-flex items-center gap-1 p-1 rounded-md', className)}
        style={{
          background: 'var(--surface-subtle)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      className={cn('flex items-center gap-0', className)}
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { activeTab, setActiveTab, variant } = useTabsContext();
  const isActive = activeTab === value;

  if (variant === 'pills') {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        onClick={() => setActiveTab(value)}
        className={cn('px-3 py-1.5 rounded-md text-[13px] transition-all', className)}
        style={{
          fontWeight: isActive ? 600 : 400,
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          background: isActive ? 'var(--surface-base)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          boxShadow: isActive ? 'var(--shadow-xs)' : 'none',
        }}
      >
        {children}
      </button>
    );
  }

  /* Underline variant (default) */
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => setActiveTab(value)}
      className={cn(className)}
      style={{
        padding: '9px 16px',
        fontSize: 'var(--text-sm)',
        fontWeight: isActive ? 600 : 400,
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: 'transparent',
        border: 'none',
        borderBottom: isActive
          ? '2px solid var(--brand)'
          : '2px solid transparent',
        marginBottom: '-1px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'color 100ms cubic-bezier(0.16,1,0.3,1), border-color 100ms cubic-bezier(0.16,1,0.3,1)',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)';
      }}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { activeTab } = useTabsContext();
  if (activeTab !== value) return null;
  return (
    <div role="tabpanel" className={cn('mt-4', className)}>
      {children}
    </div>
  );
}
