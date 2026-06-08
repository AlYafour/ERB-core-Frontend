'use client';

import type { CSSProperties } from 'react';

function Bone({
  w = '100%',
  h = 16,
  r = 6,
  mt,
}: {
  w?: string | number;
  h?: number;
  r?: number;
  mt?: number;
}) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        marginTop: mt,
        background: 'var(--surface-subtle)',
        animation: 'skeleton-pulse 1.4s ease-in-out infinite',
      } as CSSProperties}
    />
  );
}

export function KanbanSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '16px' }}>
      {[0, 1, 2, 3].map((col) => (
        <div key={col} style={{ width: 280, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Bone w={8} h={8} r={99} />
            <Bone w={80} h={14} />
          </div>
          {[0, 1, 2].map((card) => (
            <div
              key={card}
              style={{
                padding: 14,
                borderRadius: 10,
                border: '1px solid var(--border-subtle)',
                background: 'var(--card-bg)',
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Bone w={60} h={12} />
                <Bone w={32} h={12} />
              </div>
              <Bone h={14} w="90%" />
              <Bone h={12} w="60%" mt={6} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                <Bone w={24} h={24} r={99} />
                <Bone w={48} h={12} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div>
      {[0, 1, 2, 3, 4].map((row) => (
        <div
          key={row}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <Bone w={20} h={20} r={4} />
          <div style={{ flex: 1 }}>
            <Bone h={13} w="40%" />
            <Bone h={11} w="20%" mt={5} />
          </div>
          <Bone w={80} h={22} r={99} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 120 }}>
            <Bone w={24} h={24} r={99} />
            <Bone w={80} h={13} />
          </div>
          <Bone w={60} h={13} />
        </div>
      ))}
    </div>
  );
}

export function TeamListSkeleton() {
  return (
    <div style={{ padding: '8px 10px' }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            padding: '11px 12px',
            borderRadius: 8,
            marginBottom: 4,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <Bone w={36} h={36} r={9} />
          <div style={{ flex: 1 }}>
            <Bone h={13} w="70%" />
            <Bone h={11} w="50%" mt={5} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DrawerSkeleton() {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Bone w={80} h={22} r={99} />
        <Bone w={60} h={22} r={99} />
        <Bone w={70} h={22} r={99} />
      </div>
      <Bone h={24} w="80%" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 16,
          paddingTop: 16,
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i}>
            <Bone h={10} w="60%" />
            <Bone h={32} mt={6} />
          </div>
        ))}
      </div>
      <Bone h={80} r={8} />
    </div>
  );
}
