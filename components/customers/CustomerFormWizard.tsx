'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { customersApi, SharedOptions } from '@/lib/api/customers';
import { toast } from '@/lib/hooks/use-toast';
import { Button } from '@/components/ui';
import DynamicFormStep from './DynamicFormStep';
import ownerFormConfig from './formConfigs/ownerFormConfig';
import companyFormConfig from './formConfigs/companyFormConfig';
import { FormStep } from './formConfigs/basicFormConfig';

const OwnerIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const CommercialIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const ConsultantIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    <line x1="12" y1="12" x2="12" y2="16" />
    <line x1="10" y1="14" x2="14" y2="14" />
  </svg>
);

const CUSTOMER_TYPES = [
  {
    value: 'owner',
    label: 'Owner',
    description: 'Individual with direct property ownership rights and personal identification',
    Icon: OwnerIcon,
  },
  {
    value: 'commercial',
    label: 'Commercial',
    description: 'Business entity or commercial organization with trade license',
    Icon: CommercialIcon,
  },
  {
    value: 'consultant',
    label: 'Consultant',
    description: 'Professional consulting or advisory firm with company registration',
    Icon: ConsultantIcon,
  },
];

const SKIP_PREFIXES = [
  'authorized_people', 'passport', 'national_id', 'signature',
  'personal_image', 'company_', 'legal_person', 'contact_people',
];

export default function CustomerFormWizard() {
  const router = useRouter();
  const [pendingType, setPendingType] = useState('');
  const [customerType, setCustomerType] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [options, setOptions] = useState<Partial<SharedOptions>>({});
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoadingOptions(true);
    customersApi.getSharedOptions().then(setOptions).finally(() => setLoadingOptions(false));
  }, []);

  const formConfig = customerType === 'owner'
    ? ownerFormConfig
    : ['commercial', 'consultant'].includes(customerType)
    ? companyFormConfig
    : null;

  const steps: FormStep[] = formConfig?.steps || [];
  const currentStepConfig = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const confirmType = () => {
    if (!pendingType) return;
    setCustomerType(pendingType);
    setCurrentStep(0);
    setFormData({});
  };

  const changeType = () => {
    setCustomerType('');
    setPendingType('');
    setCurrentStep(0);
    setFormData({});
  };

  const handleSubmit = async () => {
    const payload = new FormData();
    payload.append('customer_type', customerType);

    if (customerType === 'owner') {
      Object.entries(formData).forEach(([key, value]) => {
        if (key === 'authorized_people') return;
        if (
          key.startsWith('passport') ||
          key.startsWith('national_id') ||
          key.startsWith('signature') ||
          key.startsWith('personal_image') ||
          ['birth_date', 'home_address', 'gender', 'nationality'].includes(key)
        ) {
          if (value instanceof File) {
            payload.append(`owner_profile.${key}`, value);
          } else if (value !== null && value !== undefined) {
            payload.append(`owner_profile.${key}`, String(value));
          }
        }
      });

      const authPeople = formData.authorized_people as Record<string, unknown>[];
      if (Array.isArray(authPeople) && authPeople.length > 0) {
        payload.append('owner_profile.authorized_people', JSON.stringify(authPeople));
      }
    }

    if (['commercial', 'consultant'].includes(customerType)) {
      const companyProfileKeys = [
        'classification', 'postal_code', 'landline_number', 'company_fax', 'company_office_address',
        'company_logo_attachment', 'company_trade_license_number', 'company_trade_license_attachment',
        'company_trade_license_expiry_date', 'company_stamp_attachment', 'company_establishment_date',
        'area', 'map_location',
      ];
      companyProfileKeys.forEach((key) => {
        const value = formData[key];
        if (value === undefined || value === null) return;
        if (value instanceof File) {
          payload.append(`company_profile.${key}`, value);
        } else {
          payload.append(`company_profile.${key}`, String(value));
        }
      });

      const legalPersonFields = [
        'code', 'name_ar', 'name_en', 'notes', 'email', 'telephone_number', 'whatsapp_number',
        'country', 'city', 'area', 'birth_date', 'home_address', 'gender', 'nationality',
        'job_title', 'national_id_number', 'national_id_attachment', 'national_id_expiry_date',
        'passport_number', 'passport_attachment', 'passport_expiry_date',
        'power_of_attorney_attachment', 'power_of_attorney_expiry_date',
        'signature_attachment', 'personal_image_attachment',
      ];
      legalPersonFields.forEach((key) => {
        const value = formData[`legal_${key}`] ?? formData[key];
        if (value === undefined || value === null) return;
        if (value instanceof File) {
          payload.append(`company_profile.legal_person.${key}`, value);
        } else {
          payload.append(`company_profile.legal_person.${key}`, String(value));
        }
      });

      const contactPeople = formData.contact_people as Record<string, unknown>[];
      if (Array.isArray(contactPeople) && contactPeople.length > 0) {
        payload.append('company_profile.contact_people', JSON.stringify(contactPeople));
      }
    }

    Object.entries(formData).forEach(([key, value]) => {
      if (!SKIP_PREFIXES.some((p) => key.startsWith(p))) {
        if (value instanceof File) {
          payload.append(key, value);
        } else if (value !== null && value !== undefined) {
          payload.append(key, String(value));
        }
      }
    });

    setSubmitting(true);
    try {
      const data = await customersApi.create(payload);
      toast(`Customer created: ${data.full_name_english} (${data.code})`, 'success');
      router.push('/customers');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to create customer';
      toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Type selector ────────────────────────────────────────────────────────────
  if (!customerType) {
    return (
      <div className="card">
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1)' }}>
            Select Customer Type
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            Choose the customer category. This determines which information fields are required.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          {CUSTOMER_TYPES.map(({ value, label, description, Icon }) => {
            const selected = pendingType === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setPendingType(value)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                  textAlign: 'left',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-lg)',
                  border: selected ? '2px solid var(--brand)' : '2px solid var(--border-subtle)',
                  background: selected ? 'var(--brand-subtle)' : 'var(--surface-subtle)',
                  cursor: 'pointer',
                }}
              >
                {selected && (
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'var(--brand)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2 6 5 9 10 3" />
                    </svg>
                  </div>
                )}
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--radius-md)',
                  background: selected ? 'var(--brand-muted)' : 'var(--card-bg)',
                  border: `1px solid ${selected ? 'var(--brand-muted)' : 'var(--border-subtle)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: selected ? 'var(--brand)' : 'var(--text-tertiary)',
                  flexShrink: 0,
                }}>
                  <Icon />
                </div>
                <div>
                  <p style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', margin: 0 }}>
                    {label}
                  </p>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0', lineHeight: 1.5 }}>
                    {description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
          <Button variant="primary" disabled={!pendingType} onClick={confirmType}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  // ── Form with stepper ────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

      {/* Stepper */}
      {steps.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {steps.map((step, idx) => (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: idx < steps.length - 1 ? 1 : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)',
                  background: idx < currentStep
                    ? 'var(--status-success)'
                    : idx === currentStep
                    ? 'var(--brand)'
                    : 'var(--surface-subtle)',
                  color: idx < currentStep || idx === currentStep ? 'white' : 'var(--text-tertiary)',
                  border: idx > currentStep ? '1.5px solid var(--border-default)' : 'none',
                  flexShrink: 0,
                }}>
                  {idx < currentStep ? (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2 6 5 9 10 3" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>
                <span style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: idx === currentStep ? 'var(--weight-semibold)' : 'var(--weight-normal)',
                  color: idx < currentStep
                    ? 'var(--status-success)'
                    : idx === currentStep
                    ? 'var(--text-primary)'
                    : 'var(--text-tertiary)',
                  whiteSpace: 'nowrap',
                }}>
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div style={{
                  flex: 1,
                  height: 1,
                  background: idx < currentStep ? 'var(--status-success)' : 'var(--border-subtle)',
                  margin: '0 var(--space-3)',
                }} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form card */}
      <div className="card">
        {loadingOptions && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-3)' }}>
            Loading options...
          </p>
        )}

        <DynamicFormStep
          step={currentStepConfig}
          formData={formData}
          setFormData={setFormData}
          options={options}
          loadingOptions={loadingOptions}
        />

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {currentStep > 0 && (
              <Button variant="secondary" onClick={() => setCurrentStep((p) => p - 1)}>
                Back
              </Button>
            )}
            <Button variant="ghost" onClick={changeType}>
              Change Type
            </Button>
          </div>

          {!isLastStep ? (
            <Button variant="primary" onClick={() => setCurrentStep((p) => p + 1)}>
              Next
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={submitting}
              isLoading={submitting}
            >
              {submitting ? 'Saving...' : 'Save Customer'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
