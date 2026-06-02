'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://erp-backend-production-fc5b.up.railway.app/api';

type ViolationInfo = {
  id: number;
  reference_number: string;
  sector: string;
  plot: string;
  area: string;
  violation_description: string;
  deadline_days: number | null;
  fine_amount: string | null;
  received_at: string;
  status: string;
  project_name: string | null;
  engineer_name: string | null;
  resolved_at: string | null;
};

export default function ResolvePage() {
  const params = useParams();
  const token = params?.token as string;

  const [violation, setViolation] = useState<ViolationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState<'received' | 'resolved' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/violations/resolve/${token}/`)
      .then(r => setViolation(r.data))
      .catch(() => setError('الرابط غير صالح أو منتهي الصلاحية'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAction = async (action: 'received' | 'resolved') => {
    setSubmitting(true);
    try {
      await axios.post(`${API}/violations/resolve/${token}/`, { action });
      setDone(action);
      if (violation) setViolation({ ...violation, status: action === 'resolved' ? 'resolved' : 'notified' });
    } catch {
      setError('حدث خطأ، يرجى المحاولة مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={styles.center}>
      <div style={styles.spinner} />
    </div>
  );

  if (error) return (
    <div style={styles.center}>
      <div style={{ ...styles.card, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
        <p style={{ color: '#EF4444', fontWeight: 600 }}>{error}</p>
      </div>
    </div>
  );

  if (!violation) return null;

  const isResolved = violation.status === 'resolved' || done === 'resolved';
  const isReceived = done === 'received';

  return (
    <div style={styles.page} dir="rtl">
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.header}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
          <h1 style={styles.title}>مخالفة بلدية أبوظبي</h1>
          <p style={styles.ref}>مرجع: {violation.reference_number}</p>
        </div>

        {/* Status banner */}
        {isResolved && (
          <div style={styles.successBanner}>
            ✅ تم تسجيل الحل بنجاح — شكراً لك
          </div>
        )}
        {isReceived && !isResolved && (
          <div style={{ ...styles.successBanner, background: '#DBEAFE', color: '#1E40AF' }}>
            ✅ تم تسجيل الاستلام — يرجى إنهاء المعالجة في أقرب وقت
          </div>
        )}

        {/* Details */}
        <div style={styles.body}>
          <Row label="المشروع"    value={violation.project_name  ?? 'غير محدد'} />
          <Row label="المنطقة"    value={violation.area           || '—'} />
          <Row label="الحوض"      value={violation.sector         || '—'} />
          <Row label="القطعة"     value={violation.plot           || '—'} />
          <Row label="المهندس"    value={violation.engineer_name  ?? 'غير محدد'} />
          <Row
            label="قيمة الغرامة"
            value={violation.fine_amount ? `${Number(violation.fine_amount).toLocaleString()} درهم` : '—'}
            highlight={!!violation.fine_amount}
          />
          <Row
            label="المهلة"
            value={violation.deadline_days != null ? `${violation.deadline_days} يوم` : '—'}
            urgent={violation.deadline_days != null && violation.deadline_days <= 3}
          />
          <Row
            label="تاريخ الاستلام"
            value={new Date(violation.received_at).toLocaleDateString('ar-AE', {
              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          />
          {violation.violation_description && (
            <div style={styles.desc}>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>وصف المخالفة:</p>
              <p style={{ fontSize: 13, lineHeight: 1.6 }}>{violation.violation_description}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {!isResolved && (
          <div style={styles.actions}>
            <button
              onClick={() => handleAction('received')}
              disabled={submitting || isReceived}
              style={{ ...styles.btn, ...styles.btnSecondary, opacity: (submitting || isReceived) ? 0.6 : 1 }}
            >
              {isReceived ? '✓ تم التسجيل' : '📥 استلمت — سأعالجها'}
            </button>
            <button
              onClick={() => handleAction('resolved')}
              disabled={submitting}
              style={{ ...styles.btn, ...styles.btnPrimary, opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? '...' : '✅ تم الحل والمعالجة'}
            </button>
          </div>
        )}

        <p style={styles.footer}>
          ال يافور للنقليات والمقاولات — نظام ERP
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, highlight, urgent }: {
  label: string; value: string; highlight?: boolean; urgent?: boolean;
}) {
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <span style={{
        ...styles.value,
        color: urgent ? '#DC2626' : highlight ? '#DC2626' : '#111827',
        fontWeight: (highlight || urgent) ? 700 : 500,
      }}>
        {value}
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#F3F4F6',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: 'system-ui, -apple-system, Arial, sans-serif',
  },
  center: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F3F4F6',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
    width: '100%',
    maxWidth: 520,
    overflow: 'hidden',
  },
  header: {
    background: 'linear-gradient(135deg, #B91C1C, #DC2626)',
    color: '#fff',
    padding: '28px 24px 20px',
    textAlign: 'center',
  },
  title: { margin: 0, fontSize: 20, fontWeight: 700 },
  ref: { margin: '6px 0 0', fontSize: 13, opacity: 0.85 },
  successBanner: {
    background: '#D1FAE5',
    color: '#065F46',
    padding: '12px 20px',
    textAlign: 'center',
    fontWeight: 600,
    fontSize: 15,
  },
  body: { padding: '16px 20px' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #F3F4F6',
  },
  label: { fontSize: 13, color: '#6B7280' },
  value: { fontSize: 14 },
  desc: {
    background: '#F9FAFB',
    borderRadius: 8,
    padding: '12px',
    marginTop: 12,
    color: '#374151',
  },
  actions: {
    display: 'flex',
    gap: 12,
    padding: '16px 20px 8px',
    flexDirection: 'column',
  },
  btn: {
    padding: '14px 20px',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600,
    transition: 'opacity 0.15s',
  },
  btnPrimary: { background: '#10B981', color: '#fff' },
  btnSecondary: { background: '#EFF6FF', color: '#1D4ED8' },
  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
    padding: '12px 20px 20px',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '4px solid #E5E7EB',
    borderTop: '4px solid #DC2626',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
