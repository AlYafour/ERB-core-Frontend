'use client';
import { ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SharedOptions } from '@/lib/api/customers';
import FormSection from '../ui/FormSection';
import FileUploadField from '../ui/FileUploadField';

// ── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  code:                z.string().optional(),
  full_name_arabic:    z.string().min(1, 'Arabic name is required'),
  full_name_english:   z.string().min(1, 'English name is required'),
  email:               z.string().optional(),
  telephone_number:    z.string().optional(),
  whatsapp_number:     z.string().optional(),
  country:             z.string().optional(),
  city:                z.string().optional(),
  area:                z.string().optional(),
  bank_name:           z.string().optional(),
  bank_account:        z.string().optional(),
  account_holder_name: z.string().optional(),
  iban_number:         z.string().optional(),
  currency:            z.string().optional(),
  preferred_language:  z.string().optional(),
  notes:               z.string().optional(),
});

type BasicFormValues = z.infer<typeof schema>;

// ── Props ────────────────────────────────────────────────────────────────────

interface BasicInfoFormProps {
  formId: string;
  formData: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  options: Partial<SharedOptions>;
  loadingOptions?: boolean;
}

// ── Section Icons ─────────────────────────────────────────────────────────────

const IdentityIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <circle cx="9" cy="11" r="2.5" />
    <path d="M15 9h4M15 12h4M15 15h2M4 19c0-2.2 2-4 4.5-4s4.5 1.8 4.5 4" />
  </svg>
);

const LocationIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const BankIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const PrefsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
  </svg>
);

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label, required, error, children, fullWidth = false,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div style={fullWidth ? { gridColumn: '1 / -1' } : {}}>
      <div className="form-field">
        <label className="form-label">
          {label}
          {required && <span style={{ color: 'var(--color-error)', marginLeft: 2 }}>*</span>}
        </label>
        {children}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginTop: 3 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--color-error)', flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4m0 4h.01" />
            </svg>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)', margin: 0 }}>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── BasicInfoForm ─────────────────────────────────────────────────────────────

export default function BasicInfoForm({
  formId, formData, onSubmit, options, loadingOptions,
}: BasicInfoFormProps) {
  const [ibanFile, setIbanFile] = useState<File | string | null>(
    (formData.iban_certificate_attachment as File | string | null) ?? null
  );

  const { register, handleSubmit, formState: { errors } } = useForm<BasicFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code:                (formData.code as string)                ?? '',
      full_name_arabic:    (formData.full_name_arabic as string)    ?? '',
      full_name_english:   (formData.full_name_english as string)   ?? '',
      email:               (formData.email as string)               ?? '',
      telephone_number:    (formData.telephone_number as string)    ?? '',
      whatsapp_number:     (formData.whatsapp_number as string)     ?? '',
      country:             (formData.country as string)             ?? '',
      city:                (formData.city as string)                ?? '',
      area:                (formData.area as string)                ?? '',
      bank_name:           (formData.bank_name as string)           ?? '',
      bank_account:        (formData.bank_account as string)        ?? '',
      account_holder_name: (formData.account_holder_name as string) ?? '',
      iban_number:         (formData.iban_number as string)         ?? '',
      currency:            (formData.currency as string)            ?? '',
      preferred_language:  (formData.preferred_language as string)  ?? '',
      notes:               (formData.notes as string)               ?? '',
    },
  });

  const onValid = (values: BasicFormValues) => {
    onSubmit({ ...values, iban_certificate_attachment: ibanFile });
  };

  const countries   = options.countries   ?? [];
  const cities      = options.cities      ?? [];
  const currencies  = options.currency    ?? [];
  const languages   = options.languages   ?? [];
  const isOptsLoading = loadingOptions ?? false;

  return (
    <form
      id={formId}
      onSubmit={handleSubmit(onValid)}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
    >

      {/* ── Section 1: Customer Identity ─────────────────────────────────── */}
      <FormSection
        title="Customer Identity"
        description="Core identification and contact details"
        icon={<IdentityIcon />}
      >
        <Field label="Customer Code" error={errors.code?.message}>
          <input
            type="text"
            className="form-input"
            placeholder="Auto-generated if left empty"
            {...register('code')}
          />
        </Field>

        <Field label="Full Name (Arabic)" required error={errors.full_name_arabic?.message}>
          <input
            type="text"
            className="form-input"
            dir="rtl"
            placeholder="الاسم الكامل بالعربي"
            {...register('full_name_arabic')}
          />
        </Field>

        <Field label="Full Name (English)" required error={errors.full_name_english?.message}>
          <input
            type="text"
            className="form-input"
            placeholder="Full name as on official documents"
            {...register('full_name_english')}
          />
        </Field>

        <Field label="Email Address" error={errors.email?.message}>
          <input
            type="email"
            className="form-input"
            placeholder="email@domain.com"
            {...register('email')}
          />
        </Field>

        <Field label="Telephone Number" error={errors.telephone_number?.message}>
          <input
            type="text"
            className="form-input"
            placeholder="+971 XX XXX XXXX"
            {...register('telephone_number')}
          />
        </Field>

        <Field label="WhatsApp Number" error={errors.whatsapp_number?.message}>
          <input
            type="text"
            className="form-input"
            placeholder="+971 XX XXX XXXX"
            {...register('whatsapp_number')}
          />
        </Field>
      </FormSection>

      {/* ── Section 2: Location Details ──────────────────────────────────── */}
      <FormSection
        title="Location Details"
        description="Geographic information for correspondence and operations"
        icon={<LocationIcon />}
      >
        <Field label="Country" error={errors.country?.message}>
          <select
            className="form-select"
            disabled={isOptsLoading && countries.length === 0}
            {...register('country')}
          >
            <option value="">— Select Country —</option>
            {countries.map((c) => (
              <option key={String(c.value)} value={String(c.value)}>{c.label}</option>
            ))}
          </select>
        </Field>

        <Field label="City" error={errors.city?.message}>
          <select
            className="form-select"
            disabled={isOptsLoading && cities.length === 0}
            {...register('city')}
          >
            <option value="">— Select City —</option>
            {cities.map((c) => (
              <option key={String(c.value)} value={String(c.value)}>{c.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Area / District" error={errors.area?.message}>
          <input
            type="text"
            className="form-input"
            placeholder="Neighborhood or district"
            {...register('area')}
          />
        </Field>
      </FormSection>

      {/* ── Section 3: Banking Details ───────────────────────────────────── */}
      <FormSection
        title="Banking Details"
        description="Payment account and financial information"
        icon={<BankIcon />}
      >
        <Field label="Bank Name" error={errors.bank_name?.message}>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. First Abu Dhabi Bank"
            {...register('bank_name')}
          />
        </Field>

        <Field label="Bank Account Number" error={errors.bank_account?.message}>
          <input
            type="text"
            className="form-input"
            placeholder="Account number"
            {...register('bank_account')}
          />
        </Field>

        <Field label="Account Holder Name" error={errors.account_holder_name?.message}>
          <input
            type="text"
            className="form-input"
            placeholder="Name as registered with the bank"
            {...register('account_holder_name')}
          />
        </Field>

        <Field label="IBAN Number" error={errors.iban_number?.message}>
          <input
            type="text"
            className="form-input"
            placeholder="AE XX XXXX XXXX XXXX XXXX XXX"
            {...register('iban_number')}
          />
        </Field>

        <div style={{ gridColumn: '1 / -1' }}>
          <FileUploadField
            label="IBAN Certificate"
            value={ibanFile}
            onChange={setIbanFile}
            accept=".pdf,.jpg,.jpeg,.png"
          />
        </div>
      </FormSection>

      {/* ── Section 4: Preferences & Notes ───────────────────────────────── */}
      <FormSection
        title="Preferences & Notes"
        description="Communication preferences and any additional remarks"
        icon={<PrefsIcon />}
      >
        <Field label="Currency" error={errors.currency?.message}>
          <select
            className="form-select"
            disabled={isOptsLoading && currencies.length === 0}
            {...register('currency')}
          >
            <option value="">— Select Currency —</option>
            {currencies.map((c) => (
              <option key={String(c.value)} value={String(c.value)}>{c.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Preferred Language" error={errors.preferred_language?.message}>
          <select className="form-select" {...register('preferred_language')}>
            <option value="">— Select Language —</option>
            {languages.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Notes" error={errors.notes?.message} fullWidth>
          <textarea
            rows={4}
            className="form-textarea"
            placeholder="Any additional notes or remarks about this customer..."
            {...register('notes')}
          />
        </Field>
      </FormSection>
    </form>
  );
}
