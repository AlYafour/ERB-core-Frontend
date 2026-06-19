'use client';

function S({ h = 14, w = '100%', mb = 0, r = 6 }: { h?: number; w?: string | number; mb?: number; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r, marginBottom: mb }} />;
}

export function DocSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.25s ease' }}>
      {/* Sticky bar skeleton */}
      <S h={60} r={12} />

      {/* Linked docs skeleton */}
      <div className="card" style={{ padding: '12px 18px' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <S h={34} w={110} r={8} />
          <S h={34} w={110} r={8} />
          <S h={34} w={110} r={8} />
        </div>
      </div>

      {/* Info card skeleton */}
      <div className="card">
        <S h={18} w={200} mb={20} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <S h={9} w="45%" mb={8} />
              <S h={14} w="70%" />
            </div>
          ))}
        </div>
      </div>

      {/* Items table skeleton */}
      <div className="card">
        <S h={18} w={150} mb={20} />
        <S h={36} w="100%" mb={10} r={6} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
            <S h={13} w="30%" />
            <S h={13} w="10%" />
            <S h={13} w="10%" />
            <S h={13} w="15%" />
            <S h={13} w="15%" />
            <S h={13} w="10%" />
          </div>
        ))}
      </div>

      {/* Summary skeleton */}
      <div className="card">
        <S h={18} w={180} mb={20} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: 272, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <S h={12} w={80} />
                <S h={12} w={80} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
