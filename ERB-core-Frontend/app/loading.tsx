export default function GlobalLoading() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--surface-app, #f8fafc)' }}>
      {/* Sidebar skeleton */}
      <aside style={{
        position: 'fixed', top: 0, insetInlineStart: 0,
        width: 'var(--sidebar-width, 13.75rem)', height: '100vh',
        background: 'var(--sidebar-bg, #1e293b)',
        borderInlineEnd: '1px solid var(--sidebar-border, #334155)',
        zIndex: 50, padding: '1rem 0.75rem',
        display: 'flex', flexDirection: 'column', gap: '0.5rem',
      }}>
        {/* Logo placeholder */}
        <div style={{ height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.08)', marginBottom: '1rem' }} className="skeleton-pulse" />
        {[1,2,3,4,5,6,7].map(i => (
          <div key={i} style={{
            height: 36, borderRadius: 6,
            background: 'rgba(255,255,255,0.06)',
            opacity: 1 - i * 0.1,
          }} className="skeleton-pulse" />
        ))}
      </aside>

      {/* Navbar skeleton */}
      <nav style={{
        position: 'fixed', top: 0,
        insetInlineStart: 'var(--sidebar-width, 13.75rem)', insetInlineEnd: 0,
        height: 'var(--navbar-height, 52px)',
        background: 'var(--navbar-bg, #fff)',
        borderBottom: '1px solid var(--navbar-border, #e2e8f0)',
        zIndex: 40, display: 'flex', alignItems: 'center',
        padding: '0 1.5rem', gap: '0.75rem',
      }}>
        <div style={{ flex: 1, height: 20, maxWidth: 200, borderRadius: 4, background: 'var(--surface-subtle, #f1f5f9)' }} className="skeleton-pulse" />
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-subtle, #f1f5f9)' }} className="skeleton-pulse" />
      </nav>

      {/* Content area */}
      <div style={{
        marginInlineStart: 'var(--sidebar-width, 13.75rem)',
        paddingTop: 'var(--navbar-height, 52px)',
        flex: 1, padding: 'calc(var(--navbar-height, 52px) + 1.5rem) 1.5rem 1.5rem',
      }}>
        {/* Page header */}
        <div style={{ height: 28, width: 220, borderRadius: 6, background: 'var(--surface-subtle, #f1f5f9)', marginBottom: '1.5rem' }} className="skeleton-pulse" />

        {/* Table shell */}
        <div style={{
          background: 'var(--card-bg, #fff)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{ height: 44, background: 'var(--surface-subtle, #f8fafc)', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', display: 'flex', alignItems: 'center', gap: '1rem', padding: '0 1rem' }}>
            {[25, 18, 12, 15, 10].map((w, i) => (
              <div key={i} style={{ height: 14, width: `${w}%`, borderRadius: 4, background: 'var(--surface-muted, #e2e8f0)' }} className="skeleton-pulse" />
            ))}
          </div>
          {/* Table rows */}
          {[1,2,3,4,5,6,7].map(i => (
            <div key={i} style={{
              height: 52, borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
              display: 'flex', alignItems: 'center', gap: '1rem', padding: '0 1rem',
            }}>
              {[25, 18, 12, 15, 10].map((w, j) => (
                <div key={j} style={{
                  height: 14, width: `${w}%`, borderRadius: 4,
                  background: 'var(--surface-subtle, #f1f5f9)',
                  opacity: 1 - i * 0.08,
                }} className="skeleton-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .skeleton-pulse {
          animation: skeletonPulse 1.5s ease-in-out infinite;
        }
        @keyframes skeletonPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
