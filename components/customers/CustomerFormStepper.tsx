'use client';
import { FormStep } from './formConfigs/basicFormConfig';

interface CustomerFormStepperProps {
  steps: FormStep[];
  currentStep: number;
}

export default function CustomerFormStepper({ steps, currentStep }: CustomerFormStepperProps) {
  if (steps.length <= 1) return null;

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-4) var(--space-5)',
      boxShadow: 'var(--card-shadow)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {steps.map((step, idx) => (
          <div
            key={step.id}
            style={{ display: 'flex', alignItems: 'center', flex: idx < steps.length - 1 ? 1 : 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
              {/* Circle indicator */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)',
                background: idx < currentStep
                  ? 'var(--status-success)'
                  : idx === currentStep
                  ? 'var(--brand)'
                  : 'var(--surface-subtle)',
                color: idx < currentStep || idx === currentStep ? 'white' : 'var(--text-tertiary)',
                border: idx > currentStep ? '1.5px solid var(--border-default)' : 'none',
              }}>
                {idx < currentStep ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2 6 5 9 10 3" />
                  </svg>
                ) : idx + 1}
              </div>

              {/* Step label + sub-label */}
              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: idx === currentStep ? 'var(--weight-semibold)' : 'var(--weight-normal)',
                  color: idx < currentStep
                    ? 'var(--status-success)'
                    : idx === currentStep
                    ? 'var(--text-primary)'
                    : 'var(--text-tertiary)',
                  margin: 0, whiteSpace: 'nowrap',
                }}>
                  {step.label}
                </p>
                <p style={{
                  fontSize: 'var(--text-xs)',
                  color: idx < currentStep
                    ? 'var(--status-success)'
                    : 'var(--text-tertiary)',
                  margin: 0, whiteSpace: 'nowrap', opacity: 0.8,
                }}>
                  {idx < currentStep ? 'Completed' : idx === currentStep ? 'In progress' : 'Pending'}
                </p>
              </div>
            </div>

            {/* Connector line */}
            {idx < steps.length - 1 && (
              <div style={{
                flex: 1,
                height: 2,
                background: idx < currentStep ? 'var(--status-success)' : 'var(--border-subtle)',
                margin: '0 var(--space-4)',
                borderRadius: 2,
              }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
