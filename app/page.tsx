'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { BRAND, XERB } from '@/lib/config/brand';
import { tenantApi } from '@/lib/api/tenants';
import { getApiError } from '@/lib/utils/error';
import DarkModeToggle from '@/components/ui/DarkModeToggle';

const C = XERB.colors;

// ─── Feature definitions ──────────────────────────────────────────────────────

const FEATURES = [
  {
    title: 'Smart Procurement',
    body:  'Full purchase-to-pay workflow: requests, quotations, orders, goods receiving, and invoices in one place.',
    icon:  <ProcurementIcon />,
  },
  {
    title: 'HR Management',
    body:  'Employees, attendance, payroll, and leave requests — centralised for every department.',
    icon:  <HRIcon />,
  },
  {
    title: 'Project Tracking',
    body:  'Link budgets to projects, track cost codes, and tie every purchase to a real project.',
    icon:  <ProjectIcon />,
  },
  {
    title: 'Subcontractors',
    body:  'Manage contracts, BOQ libraries, payment certificates, and performance in one module.',
    icon:  <SubcontractorIcon />,
  },
  {
    title: 'Tasks & Teams',
    body:  'Assign work, track progress, manage team workloads, and collaborate across departments.',
    icon:  <TasksIcon />,
  },
  {
    title: 'Multi-Company Isolation',
    body:  "Every company's data is fully isolated. One platform, unlimited clients — zero cross-leakage.",
    icon:  <ShieldIcon />,
  },
];

// ─── Pricing tiers ────────────────────────────────────────────────────────────

const PLANS = [
  {
    name:      'Starter',
    price:     '$XX',
    period:    '/mo',
    priceNote: 'Placeholder — price TBD',
    highlight: false,
    limit:     'Up to 25 users',
    features:  ['Procurement module', 'HR management', 'Project tracking', 'Email support'],
    cta:       'Get started',
    ctaHref:   '/company-login',
  },
  {
    name:      'Professional',
    price:     '$XX',
    period:    '/mo',
    priceNote: 'Placeholder — price TBD',
    highlight: true,
    limit:     'Up to 100 users',
    features:  ['Everything in Starter', 'Subcontractors module', 'Tasks & teams', 'AI assistant', 'Priority support'],
    cta:       'Get started',
    ctaHref:   '/company-login',
  },
  {
    name:      'Enterprise',
    price:     'Custom',
    period:    '',
    priceNote: 'Contact us for a quote',
    highlight: false,
    limit:     'Unlimited users',
    features:  ['Everything in Professional', 'White-label branding', 'Dedicated onboarding', 'SLA guarantee', '24/7 support'],
    cta:       'Contact us',
    ctaHref:   '#contact',
  },
];

// ─── Icon components ──────────────────────────────────────────────────────────

function ProcurementIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  );
}
function HRIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}
function ProjectIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
    </svg>
  );
}
function SubcontractorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20h20"/><path d="M9 20V8a1 1 0 011-1h4a1 1 0 011 1v12"/><path d="M4 20v-4a2 2 0 012-2h1"/><path d="M17 20v-4a2 2 0 012-2h-1"/><path d="M12 3v4"/><path d="M8 7h8"/>
    </svg>
  );
}
function TasksIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12l2 2 4-4"/>
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const MAX_W   = '1200px';
const SECTION = { width: '100%', maxWidth: MAX_W, margin: '0 auto', padding: '0 24px' };

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter();
  const [scrolled,   setScrolled]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [modalCode,  setModalCode]  = useState('');
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  const { mutate: validateModalCode, isPending: isModalValidating } = useMutation({
    mutationFn: (code: string) => tenantApi.validateCompanyCode(code),
    onSuccess: (data, code) => {
      const upper = code.toUpperCase();
      sessionStorage.setItem('xerb_prevalidated_tenant', JSON.stringify({
        code: upper,
        tenant: { name: data.tenant_name ?? '', plan: data.plan ?? '', status: data.status ?? 'active' },
        branding: data.branding ?? null,
      }));
      setModalOpen(false);
      setModalCode('');
      setModalError('');
      router.push('/company-login');
    },
    onError: (err: unknown) => {
      setModalError(getApiError(err, 'Company code not found. Please check and try again.'));
    },
  });

  const scrollTo = useCallback((id: string) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const goToLogin = useCallback(() => {
    setMobileOpen(false);
    setModalError('');
    setModalCode('');
    setModalOpen(true);
  }, []);

  return (
    <div style={{ backgroundColor: 'var(--surface-app)', color: 'var(--text-primary)', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Navbar ────────────────────────────────────────────────────── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, height: 64,
        backgroundColor: 'var(--surface-base)',
        borderBottom: `1px solid ${scrolled ? 'var(--border-subtle)' : 'transparent'}`,
        boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
        transition: 'border-color 200ms, box-shadow 200ms',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{ ...SECTION, display: 'flex', alignItems: 'center' }}>

          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 1px 3px ${C.primary}45` }}>
              <Image src={XERB.logo} alt={XERB.name} width={22} height={22} style={{ objectFit: 'contain', display: 'block' }} priority />
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{BRAND.name}</span>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 40, flex: 1 }} className="hidden lg:flex">
            {[['Features', 'features'], ['Pricing', 'pricing'], ['Contact', 'contact']].map(([label, id]) => (
              <button key={id} onClick={() => scrollTo(id)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', transition: 'color 140ms' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                {label}
              </button>
            ))}
          </nav>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <DarkModeToggle />
            <Link href="/platform-login" className="hidden lg:block" style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${C.primary}40`, background: 'transparent', fontSize: 13, fontWeight: 500, color: C.primary, textDecoration: 'none', transition: 'border-color 140ms, background 140ms' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.background = `${C.primary}08`; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${C.primary}40`; e.currentTarget.style.background = 'transparent'; }}>
              Platform Admin
            </Link>
            <button onClick={goToLogin} className="hidden lg:block" style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'background 140ms', whiteSpace: 'nowrap' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.primaryHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = C.primary; }}>
              Company Login
            </button>

            <button onClick={() => setMobileOpen((v) => !v)} className="lg:hidden" style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
              {mobileOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{ position: 'fixed', top: 64, left: 0, right: 0, zIndex: 99, backgroundColor: 'var(--surface-base)', borderBottom: '1px solid var(--border-subtle)', padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[['Features', 'features'], ['Pricing', 'pricing'], ['Contact', 'contact']].map(([label, id]) => (
            <button key={id} onClick={() => scrollTo(id)} style={{ padding: '10px 12px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', textAlign: 'left' }}>
              {label}
            </button>
          ))}
          <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid var(--border-subtle)' }} />
          <Link href="/platform-login" onClick={() => setMobileOpen(false)} style={{ padding: '10px 12px', borderRadius: 8, fontSize: 15, fontWeight: 500, color: C.primary, textDecoration: 'none' }}>
            Platform Admin
          </Link>
          <button onClick={goToLogin} style={{ padding: '10px 16px', borderRadius: 8, background: C.primary, color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', textAlign: 'center' }}>
            Company Login
          </button>
        </div>
      )}

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section style={{
        paddingTop: 'calc(64px + 80px)', paddingBottom: 80,
        background: `radial-gradient(ellipse 90% 60% at 50% -10%, ${C.primary}0d 0%, transparent 65%), var(--surface-app)`,
        textAlign: 'center',
      }}>
        <div style={{ ...SECTION }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 99, background: C.subtle, border: `1px solid ${C.primary}2e`, marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.primary, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: C.primaryDark, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{BRAND.tagline}</span>
          </div>

          <h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 3.75rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em', color: 'var(--text-primary)', margin: '0 0 20px', maxWidth: 800, marginLeft: 'auto', marginRight: 'auto' }}>
            Operations & procurement,{' '}
            <span style={{ color: C.primary }}>built for contractors.</span>
          </h1>

          <p style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: 600, margin: '0 auto 40px', fontWeight: 400 }}>
            {BRAND.name} gives construction and contracting companies one unified platform for procurement,
            HR, projects, subcontractors, and team tasks — with full multi-company data isolation built in.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={goToLogin} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 28px', borderRadius: 10, background: C.primary, color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: `0 2px 8px ${C.primary}3d`, transition: 'background 140ms, transform 140ms' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.primaryHover; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = C.primary; e.currentTarget.style.transform = 'none'; }}>
              Company Login
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
            </button>
            <button onClick={() => scrollTo('pricing')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '13px 24px', borderRadius: 10, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-primary)', fontSize: 15, fontWeight: 500, cursor: 'pointer', transition: 'border-color 140ms' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}>
              See Pricing
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 48, marginTop: 64, flexWrap: 'wrap' }}>
            {[
              ['6+',   'Integrated modules'],
              ['100%', 'Multi-tenant isolated'],
              ['1',    'Platform, any number of companies'],
            ].map(([num, label]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', fontWeight: 800, color: C.primary, letterSpacing: '-0.03em' }}>{num}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: '96px 0', backgroundColor: 'var(--surface-base)' }}>
        <div style={{ ...SECTION }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.primary, marginBottom: 12 }}>Platform modules</p>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--text-primary)', margin: '0 0 16px' }}>
              Everything your team needs
            </h2>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto', lineHeight: 1.65 }}>
              Purpose-built modules that work independently or together, tailored to how contracting companies actually operate.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {FEATURES.map(({ title, body, icon }) => (
              <div key={title} style={{ padding: '28px 28px 24px', borderRadius: 14, border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-raised)', transition: 'box-shadow 180ms, border-color 180ms' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = `${C.primary}30`; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: C.subtle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.primary, marginBottom: 16, flexShrink: 0 }}>
                  {icon}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: '96px 0', backgroundColor: 'var(--surface-app)' }}>
        <div style={{ ...SECTION }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.primary, marginBottom: 12 }}>Pricing</p>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--text-primary)', margin: '0 0 16px' }}>
              Simple, transparent plans
            </h2>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', lineHeight: 1.65 }}>
              All plans include full data isolation, role-based access, and all core features. Scale as you grow.
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, padding: '5px 14px', borderRadius: 99, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--status-warning)' }}>⚠ Prices below are placeholders — final pricing TBD</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, alignItems: 'stretch', maxWidth: 960, margin: '0 auto' }}>
            {PLANS.map((plan) => (
              <div key={plan.name} style={{ padding: '36px 32px', borderRadius: 16, border: plan.highlight ? `2px solid ${C.primary}` : '1px solid var(--border-subtle)', backgroundColor: plan.highlight ? 'var(--surface-base)' : 'var(--surface-raised)', boxShadow: plan.highlight ? 'var(--shadow-lg)' : 'none', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {plan.highlight && (
                  <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', padding: '3px 16px', borderRadius: 99, background: C.primary, color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Most popular
                  </div>
                )}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{plan.name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>{plan.price}</span>
                    {plan.period && <span style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{plan.period}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{plan.priceNote}</div>
                  <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-secondary)' }}>{plan.limit}</div>
                </div>
                <div style={{ width: '100%', height: 1, background: 'var(--border-subtle)', marginBottom: 20 }} />
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
                      <span style={{ flexShrink: 0, marginTop: 2, color: 'var(--status-success)' }}><CheckIcon /></span>
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.ctaHref === '/company-login' ? (
                  <button onClick={goToLogin} style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 28, padding: '11px 20px', borderRadius: 10, border: plan.highlight ? 'none' : '1px solid var(--border-default)', background: plan.highlight ? C.primary : 'transparent', color: plan.highlight ? '#fff' : 'var(--text-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'background 140ms, border-color 140ms' }}
                    onMouseEnter={(e) => { if (plan.highlight) { e.currentTarget.style.background = C.primaryHover; } else { e.currentTarget.style.borderColor = 'var(--border-strong)'; } }}
                    onMouseLeave={(e) => { if (plan.highlight) { e.currentTarget.style.background = C.primary; } else { e.currentTarget.style.borderColor = 'var(--border-default)'; } }}>
                    {plan.cta}
                  </button>
                ) : (
                  <Link href={plan.ctaHref} style={{ display: 'block', textAlign: 'center', marginTop: 28, padding: '11px 20px', borderRadius: 10, border: plan.highlight ? 'none' : '1px solid var(--border-default)', background: plan.highlight ? C.primary : 'transparent', color: plan.highlight ? '#fff' : 'var(--text-primary)', fontSize: 14, fontWeight: 600, textDecoration: 'none', transition: 'background 140ms, border-color 140ms' }}
                    onMouseEnter={(e) => { if (plan.highlight) { e.currentTarget.style.background = C.primaryHover; } else { e.currentTarget.style.borderColor = 'var(--border-strong)'; } }}
                    onMouseLeave={(e) => { if (plan.highlight) { e.currentTarget.style.background = C.primary; } else { e.currentTarget.style.borderColor = 'var(--border-default)'; } }}>
                    {plan.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA strip ─────────────────────────────────────────────────── */}
      <section id="contact" style={{ padding: '80px 0', background: `linear-gradient(135deg, ${C.darkBg} 0%, ${C.darkSurface} 50%, ${C.darkDeep} 100%)` }}>
        <div style={{ ...SECTION, textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 800, color: '#fff', margin: '0 0 16px', letterSpacing: '-0.025em' }}>
            Ready to get started?
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', marginBottom: 36, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.65 }}>
            Your company code is all you need. Log in and see your team&apos;s operations in one place.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={goToLogin} style={{ padding: '12px 28px', borderRadius: 10, background: '#fff', color: C.primaryDark, fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'opacity 140ms' }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.92'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}>
              Company Login
            </button>
            <Link href="/platform-login" style={{ padding: '12px 24px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', fontSize: 15, fontWeight: 500, textDecoration: 'none', transition: 'border-color 140ms' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.65)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}>
              Platform Admin
            </Link>
          </div>
        </div>
      </section>

      {/* ── Company code modal ────────────────────────────────────────── */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 420, borderRadius: 16, background: 'var(--surface-base)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xl)', padding: '36px 32px 32px', position: 'relative' }}
          >
            {/* Close */}
            <button
              onClick={() => setModalOpen(false)}
              style={{ position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--surface-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
            >
              <CloseIcon />
            </button>

            {/* Logo + heading */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 1px 4px ${C.primary}45` }}>
                <Image src={XERB.logo} alt={XERB.name} width={22} height={22} style={{ objectFit: 'contain', display: 'block' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Company Login</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Enter your company code to continue</div>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!modalCode.trim() || isModalValidating) return;
                validateModalCode(modalCode.trim());
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              {modalError && (
                <div style={{ borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                  {modalError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Company Code
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. AY-001"
                  value={modalCode}
                  onChange={(e) => { setModalCode(e.target.value.toUpperCase()); setModalError(''); }}
                  style={{
                    width: '100%', padding: '11px 14px', borderRadius: 9, border: '1px solid var(--border-default)',
                    background: 'var(--surface-app)', color: 'var(--text-primary)', fontSize: 15,
                    fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                    outline: 'none', boxSizing: 'border-box', transition: 'border-color 140ms',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = C.primary; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                />
              </div>

              <button
                type="submit"
                disabled={isModalValidating || !modalCode.trim()}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 10,
                  background: (isModalValidating || !modalCode.trim()) ? 'var(--surface-subtle)' : C.primary,
                  color: (isModalValidating || !modalCode.trim()) ? 'var(--text-muted)' : '#fff',
                  fontSize: 15, fontWeight: 700, border: 'none',
                  cursor: (isModalValidating || !modalCode.trim()) ? 'not-allowed' : 'pointer',
                  transition: 'background 150ms',
                }}
              >
                {isModalValidating ? 'Verifying…' : 'Continue →'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer style={{ backgroundColor: 'var(--gray-900)', padding: '40px 0 28px', color: 'var(--gray-400)' }}>
        <div style={{ ...SECTION }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 32, marginBottom: 36 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Image src={XERB.logo} alt={XERB.name} width={18} height={18} style={{ objectFit: 'contain', display: 'block' }} />
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-100)' }}>{BRAND.name}</span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 240, margin: 0, color: 'var(--gray-500)' }}>
                {BRAND.description}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gray-600)', marginBottom: 14 }}>Platform</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[['Features', '#features'], ['Pricing', '#pricing'], ['Contact', '#contact']].map(([label, href]) => (
                    <a key={href} href={href} style={{ fontSize: 13, color: 'var(--gray-400)', textDecoration: 'none', transition: 'color 140ms' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--gray-100)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--gray-400)'; }}>
                      {label}
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gray-600)', marginBottom: 14 }}>Access</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button onClick={goToLogin} style={{ fontSize: 13, color: 'var(--gray-400)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', transition: 'color 140ms' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--gray-100)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--gray-400)'; }}>
                    Company Login
                  </button>
                  <Link href="/platform-login" style={{ fontSize: 13, color: 'var(--gray-400)', textDecoration: 'none', transition: 'color 140ms' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--gray-100)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--gray-400)'; }}>
                    Platform Admin
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>© {BRAND.year} {BRAND.name}. All rights reserved.</span>
            <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>Built for construction. Trusted by contractors.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
