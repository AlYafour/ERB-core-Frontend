'use client';

interface DetailCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export default function DetailCard({ title, children, className = '' }: DetailCardProps) {
  return (
    <div 
      className={`card ${className}`}
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
      }}
    >
      <h2 
        className="text-base font-semibold mb-5 pb-3 border-b"
        style={{
          color: 'var(--text-primary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {children}
      </div>
    </div>
  );
}

interface DetailFieldProps {
  label: string;
  value: React.ReactNode;
  span?: 1 | 2 | 3;
  className?: string;
}

export function DetailField({ label, value, span = 1, className = '' }: DetailFieldProps) {
  const spanClass = span === 2 ? 'md:col-span-2' : span === 3 ? 'md:col-span-3' : '';
  
  return (
    <div className={`${spanClass} ${className}`}>
      <label 
        className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </label>
      <div 
        className="text-sm font-medium break-words"
        style={{ color: 'var(--text-primary)' }}
      >
        {value || <span style={{ color: 'var(--text-secondary)' }}>—</span>}
      </div>
    </div>
  );
}

