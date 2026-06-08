'use client';

import { useQuery } from '@tanstack/react-query';
import { tenantApi } from '@/lib/api/tenants';
import type { PlanInfo } from '@/types/saas';

const TIER_COLORS: Record<string, string> = {
  free:         'var(--text-secondary)',
  starter:      'var(--color-info)',
  professional: 'var(--color-warning)',
  enterprise:   'var(--wine-500)',
  custom:       'var(--color-success)',
};

const ALL_MODULES = [
  { key: 'procurement',    label: 'Procurement'    },
  { key: 'inventory',      label: 'Inventory'      },
  { key: 'hr',             label: 'HR'             },
  { key: 'crm',            label: 'CRM / Customers'},
  { key: 'projects',       label: 'Projects'       },
  { key: 'tasks',          label: 'Tasks'          },
  { key: 'subcontractors', label: 'Subcontractors' },
  { key: 'violations',     label: 'Violations'     },
  { key: 'ai',             label: 'AI Assistant'   },
];

function PlanCard({ plan }: { plan: PlanInfo }) {
  const enabledKeys = new Set(plan.plan_modules.map((m) => m.module_key));
  const tierColor = TIER_COLORS[plan.tier] ?? 'var(--text-secondary)';

  return (
    <div style={{
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 14,
      padding: '24px 28px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* Plan header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{plan.name}</h2>
          <span style={{
            display: 'inline-block', marginTop: 6,
            fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
            color: tierColor, background: `${tierColor}18`, padding: '2px 8px', borderRadius: 99,
          }}>
            {plan.tier}
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
            {Number(plan.price_aed) === 0 ? 'Free' : `${plan.price_aed} AED`}
          </div>
          {Number(plan.price_aed) > 0 && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>/ month</div>}
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', gap: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>Max Users</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{plan.max_users}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>Trial Days</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{plan.trial_days}</div>
        </div>
        {plan.tenant_count !== undefined && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>Companies</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{plan.tenant_count}</div>
          </div>
        )}
      </div>

      {/* Modules */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
          Modules
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {ALL_MODULES.map(({ key, label }) => {
            const on = enabledKeys.has(key);
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: on ? 'var(--color-success)' : 'var(--border-subtle)',
                }} />
                <span style={{ fontSize: 12, color: on ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PlansPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['super', 'plans'],
    queryFn: tenantApi.listPlans,
    staleTime: 5 * 60_000,
  });

  const plans = data?.results ?? [];

  return (
    <div style={{ maxWidth: 1100 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Plans</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
            Subscription plans and their included modules.
          </p>
        </div>

        {isLoading ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading plans…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
          </div>
        )}
      </div>
  );
}
