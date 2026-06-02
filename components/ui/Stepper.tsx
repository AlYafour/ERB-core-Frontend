'use client';

import { ReactNode } from 'react';

export interface Step {
  id: string;
  label: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: string;
  onStepClick?: (stepId: string) => void;
  completedSteps?: string[];
}

export default function Stepper({
  steps,
  currentStep,
  onStepClick,
  completedSteps = [],
}: StepperProps) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 0,
      padding: '20px 0',
      overflowX: 'auto',
    }}>
      {steps.map((step, i) => {
        const isActive    = step.id === currentStep;
        const isCompleted = completedSteps.includes(step.id) || i < currentIndex;
        const isClickable = onStepClick && (isCompleted || isActive);
        const isLast      = i === steps.length - 1;

        return (
          <div
            key={step.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              flex: isLast ? '0 0 auto' : '1 1 0',
              minWidth: 120,
            }}
          >
            {/* Step item */}
            <div
              onClick={() => isClickable && onStepClick?.(step.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                cursor: isClickable ? 'pointer' : 'default',
                flexShrink: 0,
              }}
            >
              {/* Circle */}
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 140ms cubic-bezier(0.16,1,0.3,1)',
                ...(isCompleted ? {
                  background: 'var(--brand)',
                  border: '2px solid var(--brand)',
                } : isActive ? {
                  background: 'var(--brand-subtle)',
                  border: '2px solid var(--brand)',
                } : {
                  background: 'var(--surface-subtle)',
                  border: '2px solid var(--border-default)',
                }),
              }}>
                {isCompleted ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    color: isActive ? 'var(--brand)' : 'var(--text-tertiary)',
                  }}>
                    {i + 1}
                  </span>
                )}
              </div>

              {/* Labels */}
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--text-primary)' : isCompleted ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                  whiteSpace: 'nowrap',
                }}>
                  {step.label}
                </div>
                {step.description && (
                  <div style={{
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                  }}>
                    {step.description}
                  </div>
                )}
              </div>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div style={{
                flex: 1,
                height: 2,
                marginTop: 13,
                background: isCompleted ? 'var(--brand)' : 'var(--border-subtle)',
                transition: 'background 200ms',
                minWidth: 24,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
