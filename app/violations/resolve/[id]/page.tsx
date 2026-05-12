'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { violationsApi } from '@/lib/api/violations';
import { useState } from 'react';

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  new:       { bg: '#FEF9C3', text: '#854D0E', label: 'جديدة' },
  notified:  { bg: '#DBEAFE', text: '#1E40AF', label: 'تم الإبلاغ' },
  resolved:  { bg: '#DCFCE7', text: '#166534', label: 'تم الحل' },
  fined:     { bg: '#FEE2E2', text: '#991B1B', label: 'صدرت غرامة' },
};

export default function ViolationResolvePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [resolved, setResolved] = useState(false);

  const { data: violation, isLoading, isError } = useQuery({
    queryKey: ['violation', id],
    queryFn: () => violationsApi.getById(Number(id)),
    enabled: !!id,
  });

  const resolveMutation = useMutation({
    mutationFn: () => violationsApi.markResolved(Number(id)),
    onSuccess: () => {
      setResolved(true);
      queryClient.invalidateQueries({ queryKey: ['violation', id] });
      queryClient.invalidateQueries({ queryKey: ['violations'] });
    },
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <p>جاري تحميل تفاصيل المخالفة...</p>
        </div>
      </div>
    );
  }

  if (isError || !violation) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--color-error)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>❌</div>
          <p style={{ fontWeight: 600 }}>تعذّر تحميل المخالفة</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            تحقق من صلاحياتك أو تواصل مع المسؤول.
          </p>
          <button
            onClick={() => router.back()}
            style={{
              marginTop: 16, padding: '8px 20px', borderRadius: 8,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
              cursor: 'pointer', color: 'var(--text-primary)', fontSize: 14,
            }}
          >
            رجوع
          </button>
        </div>
      </div>
    );
  }

  const status = resolved ? 'resolved' : violation.status;
  const statusStyle = statusColors[status] ?? statusColors.notified;
  const isAlreadyResolved = status === 'resolved';
  const deadlineStr = violation.deadline_days ? `${violation.deadline_days} يوم` : '—';
  const fineStr = violation.fine_amount
    ? `${Number(violation.fine_amount).toLocaleString('ar-AE')} درهم`
    : '—';

  return (
    <div
      dir="rtl"
      style={{
        maxWidth: 680,
        margin: '32px auto',
        padding: '0 16px 48px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: isAlreadyResolved ? '#166534' : '#B91C1C',
          borderRadius: '12px 12px 0 0',
          padding: '20px 24px',
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              {isAlreadyResolved ? '✅ تم حل المخالفة' : '🚨 مخالفة بلدية — إجراء عاجل'}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.85 }}>
              بلدية مدينة أبوظبي | مرجع: {violation.reference_number}
            </p>
          </div>
          <span
            style={{
              background: statusStyle.bg,
              color: statusStyle.text,
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {statusStyle.label}
          </span>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderTop: 'none',
          borderRadius: '0 0 12px 12px',
          padding: '24px',
        }}
      >
        {/* Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
          {[
            { label: 'المشروع', value: violation.project_name || '—' },
            { label: 'المهندس المسؤول', value: violation.engineer_name || '—' },
            { label: 'الحوض', value: violation.sector || '—' },
            { label: 'رقم القطعة', value: violation.plot || '—' },
            { label: 'تاريخ المخالفة', value: violation.violation_date || '—' },
            { label: 'الرقم المرجعي', value: violation.reference_number || '—' },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                padding: '12px 4px',
                borderBottom: '1px solid var(--border-primary)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Violation Description */}
        {violation.violation_description && (
          <div
            style={{
              margin: '16px 0',
              padding: '12px 16px',
              background: 'var(--bg-secondary)',
              borderRadius: 8,
              borderRight: '4px solid #EF4444',
            }}
          >
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>
              وصف المخالفة
            </p>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {violation.violation_description}
            </p>
          </div>
        )}

        {/* Deadline & Fine Warning */}
        <div
          style={{
            margin: '16px 0',
            padding: '14px 16px',
            background: 'var(--color-wine-50)',
            borderRadius: 8,
            borderRight: '4px solid var(--color-wine-500)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 13, color: '#9A3412', fontWeight: 700 }}>
              ⏰ المهلة المتاحة: {deadlineStr}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#C2410C' }}>
              يجب إزالة أسباب المخالفة قبل انتهاء المهلة
            </p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 11, color: '#9A3412' }}>الغرامة المحتملة</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#DC2626' }}>{fineStr}</p>
          </div>
        </div>

        {/* Resolution Success */}
        {resolved && (
          <div
            style={{
              margin: '16px 0',
              padding: '16px',
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: 8,
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#166534' }}>
              ✅ تم تسجيل الحل بنجاح
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#15803D' }}>
              سيتم تحديث الداشبورد تلقائياً.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
          {!isAlreadyResolved ? (
            <button
              onClick={() => resolveMutation.mutate()}
              disabled={resolveMutation.isPending}
              style={{
                flex: 1,
                padding: '12px 20px',
                background: resolveMutation.isPending ? '#9CA3AF' : '#16A34A',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 700,
                cursor: resolveMutation.isPending ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {resolveMutation.isPending ? '⏳ جاري الحفظ...' : '✅ تم الحل'}
            </button>
          ) : (
            <button
              onClick={() => router.push('/violations')}
              style={{
                flex: 1,
                padding: '12px 20px',
                background: '#1D4ED8',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              العودة للداشبورد
            </button>
          )}

          {violation.violation_url && (
            <a
              href={violation.violation_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '12px 20px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              🔗 عرض في موقع البلدية
            </a>
          )}
        </div>

        {/* Footer */}
        <p style={{ margin: '20px 0 0', fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
          رقم التواصل: 800555 | رمز التحقق: {violation.verification_code || '—'}
        </p>
      </div>
    </div>
  );
}
