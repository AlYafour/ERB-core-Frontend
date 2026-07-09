'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, PageHeader } from '@/components/ui';
import { approvalsApi, type RequestType, type ApprovalPolicy, type ApprovalStep } from '@/lib/api/approvals';

// ── Icons ─────────────────────────────────────────────────────────────────────

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    style={{ transition: 'transform 200ms', transform: open ? 'rotate(180deg)' : 'none' }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);

const DragIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="9" cy="6" r="1" fill="currentColor" /><circle cx="15" cy="6" r="1" fill="currentColor" />
    <circle cx="9" cy="12" r="1" fill="currentColor" /><circle cx="15" cy="12" r="1" fill="currentColor" />
    <circle cx="9" cy="18" r="1" fill="currentColor" /><circle cx="15" cy="18" r="1" fill="currentColor" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ── Doc type icons ────────────────────────────────────────────────────────────

const DOC_META: Record<string, { icon: string; desc: string }> = {
  purchase_request: { icon: '📋', desc: 'طلبات الشراء من الموردين' },
  purchase_order:   { icon: '📦', desc: 'أوامر الشراء الرسمية' },
  leave_request:    { icon: '🏖️', desc: 'طلبات الإجازة' },
};

// ── Roles hook ────────────────────────────────────────────────────────────────

function useRoles() {
  return useQuery({
    queryKey: ['roles-list'],
    queryFn: async () => {
      const { default: apiClient } = await import('@/lib/api/client');
      const res = await apiClient.get('/permissions/roles/?page_size=500');
      return (res.data?.results ?? res.data) as { id: number; name: string; level: number }[];
    },
  });
}

// ── Step draft type ───────────────────────────────────────────────────────────

interface StepDraft {
  _key: number;
  id?: number;
  order: number;
  approver_strategy: 'ROLE' | 'DIRECT_MANAGER' | 'INDIRECT_MANAGER';
  role: number | null;
  role_display: string | null;
  escalation_after_hours: number | null;
  sod_fallback_strategy: string | null;
}

function newStep(order: number): StepDraft {
  return { _key: Date.now() + order, order, approver_strategy: 'ROLE', role: null, role_display: null, escalation_after_hours: null, sod_fallback_strategy: 'DIRECT_MANAGER' };
}

// ── Chain editor for one document type ───────────────────────────────────────

function ChainEditor({ requestType, policies, roles, onRefresh }: {
  requestType: RequestType;
  policies: ApprovalPolicy[];
  roles: { id: number; name: string; level: number }[];
  onRefresh: () => void;
}) {
  // Use first active policy for this type, or null
  const policy = policies.find(p => p.request_types.includes(requestType.id) && p.is_active) ?? null;

  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sync state when policy changes
  useEffect(() => {
    if (policy?.steps?.length) {
      setSteps(
        [...policy.steps]
          .sort((a, b) => a.order - b.order)
          .map((s, i) => ({
            _key: s.id ?? i,
            id: s.id,
            order: s.order,
            approver_strategy: (s.approver_strategy as StepDraft['approver_strategy']) ?? 'ROLE',
            role: s.role,
            role_display: s.role_display,
            escalation_after_hours: s.escalation_after_hours,
            sod_fallback_strategy: s.sod_fallback_strategy,
          }))
      );
    } else {
      setSteps([]);
    }
  }, [policy?.id]);

  function addStep() {
    setSteps(prev => [...prev, newStep(prev.length + 1)]);
    setSaved(false);
  }

  function removeStep(key: number) {
    setSteps(prev => prev.filter(s => s._key !== key).map((s, i) => ({ ...s, order: i + 1 })));
    setSaved(false);
  }

  function updateStep(key: number, patch: Partial<StepDraft>) {
    setSteps(prev => prev.map(s => s._key === key ? { ...s, ...patch } : s));
    setSaved(false);
  }

  async function saveChain() {
    setError('');
    if (steps.some(s => s.approver_strategy === 'ROLE' && !s.role)) {
      setError('اختر الدور المطلوب في كل خطوة.');
      return;
    }
    setSaving(true);
    try {
      let savedPolicy: ApprovalPolicy;
      if (policy) {
        savedPolicy = await approvalsApi.updatePolicy(policy.id, {
          name: policy.name,
          is_active: true,
          priority: policy.priority,
          request_types: policy.request_types,
        });
        // Delete removed steps
        const keptIds = new Set(steps.filter(s => s.id).map(s => s.id));
        for (const old of policy.steps ?? []) {
          if (old.id && !keptIds.has(old.id)) await approvalsApi.deleteStep(old.id);
        }
      } else {
        savedPolicy = await approvalsApi.createPolicy({
          name: `${requestType.name} — Default`,
          is_active: true,
          priority: 10,
          request_types: [requestType.id],
          condition_field: '',
          condition_operator: '',
          condition_value: '',
        });
      }
      // Upsert steps
      for (const step of steps) {
        const payload = {
          policy: savedPolicy.id,
          order: step.order,
          approver_strategy: step.approver_strategy,
          role: step.approver_strategy === 'ROLE' ? step.role : null,
          sod_fallback_role: null,
          sod_fallback_strategy: step.sod_fallback_strategy || null,
          sod_fallback_user: null,
          specific_user: null,
          escalation_after_hours: step.escalation_after_hours,
          role_name: '',
          sod_fallback_role_name: '',
        };
        if (step.id) await approvalsApi.updateStep(step.id, payload);
        else await approvalsApi.createStep(payload as Omit<ApprovalStep, 'id'>);
      }
      setSaved(true);
      onRefresh();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? JSON.stringify(e?.response?.data) ?? 'حدث خطأ أثناء الحفظ.');
    } finally {
      setSaving(false);
    }
  }

  const STRATEGY_LABELS: Record<string, string> = {
    ROLE: 'دور محدد',
    DIRECT_MANAGER: 'المدير المباشر',
    INDIRECT_MANAGER: 'المدير غير المباشر',
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 10,
    border: '1.5px solid var(--border-default)',
    background: 'var(--surface-primary)', color: 'var(--text-primary)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Empty state */}
      {steps.length === 0 && (
        <div style={{
          padding: '32px 24px', textAlign: 'center',
          border: '2px dashed var(--border-default)', borderRadius: 14,
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
            لا توجد موافقات مطلوبة حالياً
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            أضف خطوة لتحديد من يوافق على {requestType.name}
          </div>
          <button onClick={addStep} style={{
            padding: '9px 22px', borderRadius: 10, border: 'none',
            background: 'var(--brand)', color: '#fff', fontWeight: 700,
            fontSize: 13, cursor: 'pointer',
          }}>
            + إضافة خطوة موافقة
          </button>
        </div>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            return (
              <div key={step._key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {/* Timeline */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'color-mix(in srgb, var(--brand) 15%, transparent)',
                    border: '2px solid var(--brand)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: 'var(--brand)',
                  }}>{idx + 1}</div>
                  {!isLast && (
                    <div style={{ width: 2, flex: 1, minHeight: 16, background: 'var(--border-default)', margin: '4px 0' }} />
                  )}
                </div>

                {/* Step card */}
                <div style={{
                  flex: 1, background: 'var(--card-bg)',
                  border: '1.5px solid var(--card-border)',
                  borderRadius: 12, padding: '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                      خطوة {idx + 1} — من يوافق؟
                    </span>
                    <button onClick={() => removeStep(step._key)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                      padding: 4, borderRadius: 6,
                    }}>
                      <TrashIcon />
                    </button>
                  </div>

                  {/* Approver type */}
                  <div style={{ display: 'grid', gridTemplateColumns: steps.length > 0 ? '1fr 1fr' : '1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>نوع الموافق</div>
                      <select value={step.approver_strategy}
                        onChange={e => updateStep(step._key, { approver_strategy: e.target.value as StepDraft['approver_strategy'], role: null, role_display: null })}
                        style={inp}>
                        {Object.entries(STRATEGY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>

                    {step.approver_strategy === 'ROLE' && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>الدور</div>
                        <select value={step.role ?? ''}
                          onChange={e => {
                            const r = roles.find(r => r.id === +e.target.value);
                            updateStep(step._key, { role: r ? r.id : null, role_display: r?.name ?? null });
                          }}
                          style={{ ...inp, borderColor: !step.role ? '#ef4444' : 'var(--border-default)' }}>
                          <option value="">اختر الدور...</option>
                          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Advanced toggle */}
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(v => !v)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, color: 'var(--text-muted)', padding: 0,
                    }}>
                    <ChevronIcon open={showAdvanced} />
                    إعدادات إضافية (وقت التصعيد، حالة تعارض المصالح)
                  </button>

                  {showAdvanced && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 4 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>
                          تصعيد بعد (ساعات)
                        </div>
                        <input type="number" min={1} placeholder="مثال: 24"
                          value={step.escalation_after_hours ?? ''}
                          onChange={e => updateStep(step._key, { escalation_after_hours: e.target.value ? +e.target.value : null })}
                          style={inp} />
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                          لو مافيش رد بعد الوقت ده يتصعد تلقائياً
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>
                          لو الموافق هو نفس المقدِّم
                        </div>
                        <select value={step.sod_fallback_strategy ?? ''}
                          onChange={e => updateStep(step._key, { sod_fallback_strategy: e.target.value || null })}
                          style={inp}>
                          <option value="">لا شيء</option>
                          <option value="DIRECT_MANAGER">يروح للمدير المباشر</option>
                          <option value="INDIRECT_MANAGER">يروح للمدير غير المباشر</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add step */}
      {steps.length > 0 && (
        <button onClick={addStep} style={{
          width: '100%', padding: '10px', borderRadius: 10,
          border: '1.5px dashed var(--border-default)',
          background: 'transparent', color: 'var(--text-muted)',
          fontSize: 13, cursor: 'pointer', marginBottom: 16,
          transition: 'border-color 150ms, color 150ms',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
          + إضافة خطوة موافقة أخرى
        </button>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 12,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          color: '#ef4444', fontSize: 13,
        }}>{error}</div>
      )}

      {/* Save */}
      {steps.length > 0 && (
        <button onClick={saveChain} disabled={saving} style={{
          padding: '12px', borderRadius: 12, border: 'none',
          background: saved ? '#10b981' : 'var(--brand)',
          color: '#fff', fontWeight: 700, fontSize: 14,
          cursor: saving ? 'wait' : 'pointer',
          opacity: saving ? 0.7 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background 300ms',
        }}>
          {saving ? 'جاري الحفظ...' : saved ? <><CheckIcon /> تم الحفظ</> : 'حفظ سلسلة الموافقة'}
        </button>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ApprovalChainsPage() {
  const qc = useQueryClient();
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);

  const { data: requestTypes = [], isLoading: rtLoading } = useQuery({
    queryKey: ['approval-request-types'],
    queryFn: approvalsApi.getRequestTypes,
  });

  const { data: allPolicies = [], isLoading: polLoading } = useQuery({
    queryKey: ['approval-policies'],
    queryFn: () => approvalsApi.getPolicies(),
  });

  const { data: roles = [] } = useRoles();

  useEffect(() => {
    if (requestTypes.length > 0 && selectedTypeId === null) {
      setSelectedTypeId(requestTypes[0].id);
    }
  }, [requestTypes, selectedTypeId]);

  const selectedType = requestTypes.find(rt => rt.id === selectedTypeId) ?? null;
  const isLoading = rtLoading || polLoading;

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['approval-policies'] });
  }, [qc]);

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="سلاسل الموافقة"
          description="حدد من يوافق على كل نوع من الطلبات، وبأي ترتيب"
          breadcrumbs={[{ label: 'الإعدادات', href: '/settings' }, { label: 'سلاسل الموافقة' }]}
        />

        {isLoading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            جاري التحميل...
          </div>
        ) : (

          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>

            {/* ─── Left: document type selector ─── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                نوع الوثيقة
              </div>

              {requestTypes.map(rt => {
                const meta = DOC_META[rt.code] ?? { icon: '📄', desc: '' };
                const policyCount = allPolicies.filter(p => p.request_types.includes(rt.id) && p.is_active).length;
                const isSelected = selectedTypeId === rt.id;

                return (
                  <button key={rt.id} type="button" onClick={() => setSelectedTypeId(rt.id)}
                    style={{
                      width: '100%', textAlign: 'left', cursor: 'pointer',
                      padding: '14px 16px', borderRadius: 14,
                      border: isSelected ? '2px solid var(--brand)' : '1.5px solid var(--border-default)',
                      background: isSelected ? 'color-mix(in srgb, var(--brand) 8%, var(--card-bg))' : 'var(--card-bg)',
                      transition: 'all 150ms',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                    <span style={{ fontSize: 24, flexShrink: 0 }}>{meta.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                        {rt.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{meta.desc}</div>
                    </div>
                    {policyCount > 0 ? (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: '#10b981', color: '#fff',
                      }}>مفعّل</span>
                    ) : (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: 'var(--surface-subtle)', color: 'var(--text-muted)',
                        border: '1px solid var(--border-default)',
                      }}>غير مفعّل</span>
                    )}
                  </button>
                );
              })}

              {requestTypes.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  لا توجد أنواع وثائق. تأكد من تشغيل الـ migrations.
                </div>
              )}
            </div>

            {/* ─── Right: chain editor ─── */}
            {selectedType ? (
              <div style={{
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                borderRadius: 16, padding: '24px',
              }}>
                {/* Header */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 22 }}>{DOC_META[selectedType.code]?.icon ?? '📄'}</span>
                    <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {selectedType.name}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 13, color: 'var(--text-muted)',
                    padding: '10px 14px', borderRadius: 10,
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--border-default)',
                  }}>
                    لما حد يطلب <strong>{selectedType.name}</strong>، الطلب بيمشي على الخطوات اللي تحت للموافقة بالترتيب. لو مافيش خطوات، الطلب بيتوقف.
                  </div>
                </div>

                {/* Flow preview (read-only) */}
                {(() => {
                  const p = allPolicies.find(p => p.request_types.includes(selectedType.id) && p.is_active);
                  const sortedSteps = [...(p?.steps ?? [])].sort((a, b) => a.order - b.order);
                  if (sortedSteps.length > 0) {
                    return (
                      <div style={{
                        marginBottom: 20, padding: '12px 16px', borderRadius: 12,
                        background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 8 }}>
                          مسار الموافقة الحالي
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 10px', background: 'var(--surface-subtle)', borderRadius: 20, border: '1px solid var(--border-default)' }}>
                            المقدِّم
                          </span>
                          {sortedSteps.map((s, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>→</span>
                              <span style={{
                                fontSize: 12, fontWeight: 600, padding: '4px 12px',
                                background: 'color-mix(in srgb, var(--brand) 12%, transparent)',
                                color: 'var(--brand)', borderRadius: 20,
                                border: '1px solid color-mix(in srgb, var(--brand) 30%, transparent)',
                              }}>
                                {s.role_display ?? (s.approver_strategy === 'DIRECT_MANAGER' ? 'المدير المباشر' : s.approver_strategy)}
                              </span>
                            </div>
                          ))}
                          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>→</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', padding: '4px 10px', background: 'rgba(16,185,129,0.12)', borderRadius: 20 }}>
                            مكتمل
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Editor */}
                <ChainEditor
                  key={selectedType.id}
                  requestType={selectedType}
                  policies={allPolicies}
                  roles={roles}
                  onRefresh={refresh}
                />
              </div>
            ) : (
              <div style={{
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                borderRadius: 16, padding: 40, textAlign: 'center', color: 'var(--text-muted)',
              }}>
                اختر نوع الوثيقة من اليسار
              </div>
            )}
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
}
