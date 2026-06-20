'use client';

import { useState, useRef, useCallback, type ReactNode } from 'react';
import Link from 'next/link';

interface PRData {
  id: number;
  code: string;
  status: string;
  has_quotation_requests?: boolean;
  has_awarded_quotation?: boolean;
  has_purchase_orders?: boolean;
}

type StepStatus = 'done' | 'active' | 'pending' | 'rejected';

const STEPS = [
  { key: 'pr',  short: 'PR',  long: 'Purchase Request' },
  { key: 'qr',  short: 'RFQ', long: 'Quotation Request' },
  { key: 'pq',  short: 'PQ',  long: 'Supplier Awarded' },
  { key: 'lpo', short: 'LPO', long: 'Purchase Order' },
];

function calcSteps(r: PRData): StepStatus[] {
  const approved = r.status === 'approved';
  const rejected = r.status === 'rejected';
  const hasQR    = !!r.has_quotation_requests;
  const hasPQ    = !!r.has_awarded_quotation;
  const hasLPO   = !!r.has_purchase_orders;
  return [
    rejected ? 'rejected' : 'done',
    hasQR  ? 'done'    : approved && !hasLPO ? 'active' : 'pending',
    hasPQ  ? 'done'    : hasQR ? 'active' : 'pending',
    hasLPO ? 'done'    : hasPQ ? 'active' : 'pending',
  ];
}

export function PrPipelinePopover({ request, children }: { request: PRData; children: ReactNode }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trigRef   = useRef<HTMLDivElement>(null);

  const open = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!trigRef.current) return;
      const r = trigRef.current.getBoundingClientRect();
      const left = Math.min(r.left, window.innerWidth - 276);
      setPos({ top: r.bottom + 4, left });
    }, 320);
  }, []);

  const close = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPos(null), 80);
  }, []);

  const statuses   = calcSteps(request);
  const doneCount  = statuses.filter(s => s === 'done').length;

  let currentLabel = STEPS[0].long;
  for (let i = statuses.length - 1; i >= 0; i--) {
    if (statuses[i] === 'done') { currentLabel = STEPS[i].long; break; }
  }

  return (
    <>
      <div ref={trigRef} onMouseEnter={open} onMouseLeave={close} style={{ display: 'inline-block' }}>
        {children}
      </div>

      {pos && (
        <div
          className="pr-pipe-pop"
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
          onMouseLeave={close}
        >
          {/* Steps */}
          <div className="pr-pipe-steps">
            {STEPS.flatMap((step, i) => [
              <div key={step.key} className="pr-pipe-item">
                <div className={`pr-pipe-dot pr-pipe-dot--${statuses[i]}`}>
                  {statuses[i] === 'done' && (
                    <svg width="7" height="7" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {statuses[i] === 'rejected' && (
                    <svg width="7" height="7" viewBox="0 0 10 10" fill="none">
                      <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  )}
                </div>
                <span className="pr-pipe-step-lbl">{step.short}</span>
              </div>,
              i < STEPS.length - 1
                ? <div key={`l${i}`} className={`pr-pipe-line${statuses[i] === 'done' ? ' pr-pipe-line--done' : ''}`} />
                : null,
            ]).filter(Boolean)}
          </div>

          {/* Current stage */}
          <div className="pr-pipe-stage">{currentLabel}</div>

          {/* Footer */}
          <div className="pr-pipe-foot">
            <span className="pr-pipe-progress">{doneCount}/{STEPS.length} steps</span>
            <Link
              href={`/purchase-requests/${request.id}/tracking`}
              className="pr-pipe-link"
              onClick={e => e.stopPropagation()}
            >
              Full timeline →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
