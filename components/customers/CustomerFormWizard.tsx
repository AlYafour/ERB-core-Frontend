'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { customersApi, SharedOptions } from '@/lib/api/customers';
import { toast } from '@/lib/hooks/use-toast';
import { Button } from '@/components/ui';

import CustomerTypeSelector from './CustomerTypeSelector';
import CustomerFormStepper from './CustomerFormStepper';
import FormActionBar from './FormActionBar';
import BasicInfoForm from './sections/BasicInfoForm';
import DynamicFormStep from './DynamicFormStep';
import ownerFormConfig from './formConfigs/ownerFormConfig';
import companyFormConfig from './formConfigs/companyFormConfig';
import { FormStep } from './formConfigs/basicFormConfig';

// Fields that live under type-specific sub-objects (not top-level payload)
const SKIP_PREFIXES = [
  'authorized_people', 'passport', 'national_id', 'signature',
  'personal_image', 'company_', 'legal_person', 'contact_people',
];

const BASIC_FORM_ID = 'customer-basic-form';

export default function CustomerFormWizard() {
  const router = useRouter();

  const [customerType, setCustomerType] = useState('');
  const [currentStep, setCurrentStep]   = useState(0);
  const [formData, setFormData]          = useState<Record<string, unknown>>({});
  const [options, setOptions]            = useState<Partial<SharedOptions>>({});
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting]      = useState(false);

  useEffect(() => {
    setLoadingOptions(true);
    customersApi.getSharedOptions()
      .then(setOptions)
      .finally(() => setLoadingOptions(false));
  }, []);

  const formConfig = customerType === 'owner'
    ? ownerFormConfig
    : ['commercial', 'consultant'].includes(customerType)
    ? companyFormConfig
    : null;

  const steps: FormStep[] = formConfig?.steps ?? [];
  const isLastStep = currentStep === steps.length - 1;
  const isBasicStep = currentStep === 0;

  // ── Type confirmation ────────────────────────────────────────────────────
  const handleConfirmType = (type: string) => {
    setCustomerType(type);
    setCurrentStep(0);
    setFormData({});
  };

  const handleChangeType = () => {
    setCustomerType('');
    setCurrentStep(0);
    setFormData({});
  };

  // ── Payload builder ──────────────────────────────────────────────────────
  const buildPayload = (data: Record<string, unknown>): FormData => {
    const payload = new FormData();
    payload.append('customer_type', customerType);

    if (customerType === 'owner') {
      Object.entries(data).forEach(([key, value]) => {
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
          } else if (value !== null && value !== undefined && value !== '') {
            payload.append(`owner_profile.${key}`, String(value));
          }
        }
      });
      const authPeople = data.authorized_people as Record<string, unknown>[];
      if (Array.isArray(authPeople) && authPeople.length > 0) {
        payload.append('owner_profile.authorized_people', JSON.stringify(authPeople));
      }
    }

    if (['commercial', 'consultant'].includes(customerType)) {
      const companyKeys = [
        'classification', 'postal_code', 'landline_number', 'company_fax',
        'company_office_address', 'company_logo_attachment',
        'company_trade_license_number', 'company_trade_license_attachment',
        'company_trade_license_expiry_date', 'company_stamp_attachment',
        'company_establishment_date', 'area', 'map_location',
      ];
      companyKeys.forEach((key) => {
        const value = data[key];
        if (value === undefined || value === null || value === '') return;
        if (value instanceof File) {
          payload.append(`company_profile.${key}`, value);
        } else {
          payload.append(`company_profile.${key}`, String(value));
        }
      });

      const legalFields = [
        'code', 'name_ar', 'name_en', 'notes', 'email',
        'telephone_number', 'whatsapp_number', 'country', 'city', 'area',
        'birth_date', 'home_address', 'gender', 'nationality', 'job_title',
        'national_id_number', 'national_id_attachment', 'national_id_expiry_date',
        'passport_number', 'passport_attachment', 'passport_expiry_date',
        'power_of_attorney_attachment', 'power_of_attorney_expiry_date',
        'signature_attachment', 'personal_image_attachment',
      ];
      legalFields.forEach((key) => {
        const value = data[`legal_${key}`] ?? data[key];
        if (value === undefined || value === null || value === '') return;
        if (value instanceof File) {
          payload.append(`company_profile.legal_person.${key}`, value);
        } else {
          payload.append(`company_profile.legal_person.${key}`, String(value));
        }
      });

      const contactPeople = data.contact_people as Record<string, unknown>[];
      if (Array.isArray(contactPeople) && contactPeople.length > 0) {
        payload.append('company_profile.contact_people', JSON.stringify(contactPeople));
      }
    }

    // Top-level common fields
    Object.entries(data).forEach(([key, value]) => {
      if (SKIP_PREFIXES.some((p) => key.startsWith(p))) return;
      if (value instanceof File) {
        payload.append(key, value);
      } else if (value !== null && value !== undefined && value !== '') {
        payload.append(key, String(value));
      }
    });

    return payload;
  };

  // ── Customer create ──────────────────────────────────────────────────────
  const doCreate = async (data: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const payload = buildPayload(data);
      const result  = await customersApi.create(payload);
      toast(`Customer created: ${result.full_name_english} (${result.code})`, 'success');
      router.push('/customers');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? 'Failed to create customer';
      toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── BasicInfoForm submit handler ─────────────────────────────────────────
  const handleBasicSubmit = (values: Record<string, unknown>) => {
    const merged = { ...formData, ...values };
    setFormData(merged);
    if (isLastStep) {
      doCreate(merged);
    } else {
      setCurrentStep((p) => p + 1);
    }
  };

  // ── Dynamic step next (no validation) ────────────────────────────────────
  const handleDynamicNext = () => {
    if (isLastStep) {
      doCreate(formData);
    } else {
      setCurrentStep((p) => p + 1);
    }
  };

  // ── Type not yet selected ─────────────────────────────────────────────────
  if (!customerType) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <CustomerTypeSelector onConfirm={handleConfirmType} />
      </div>
    );
  }

  const currentStepConfig = steps[currentStep];

  // ── Form with stepper ─────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

      {/* Stepper */}
      <CustomerFormStepper steps={steps} currentStep={currentStep} />

      {/* Loading options indicator */}
      {loadingOptions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'var(--brand-subtle)', border: '1px solid var(--brand-muted)', borderRadius: 'var(--radius-md)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--brand)', flexShrink: 0 }} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.51" />
          </svg>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--brand)', fontWeight: 'var(--weight-medium)' }}>
            Loading form options...
          </span>
        </div>
      )}

      {/* Step content */}
      {isBasicStep ? (
        <BasicInfoForm
          formId={BASIC_FORM_ID}
          formData={formData}
          onSubmit={handleBasicSubmit}
          options={options}
          loadingOptions={loadingOptions}
        />
      ) : (
        currentStepConfig && (
          <div className="card">
            <DynamicFormStep
              step={currentStepConfig}
              formData={formData}
              setFormData={setFormData}
              options={options}
              loadingOptions={loadingOptions}
            />
          </div>
        )
      )}

      {/* Sticky action bar */}
      <FormActionBar
        left={
          <>
            {currentStep > 0 && (
              <Button variant="secondary" onClick={() => setCurrentStep((p) => p - 1)}>
                Back
              </Button>
            )}
            <Button variant="ghost" onClick={handleChangeType}>
              Change Type
            </Button>
          </>
        }
        right={
          isBasicStep ? (
            <button
              form={BASIC_FORM_ID}
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {isLastStep
                ? (submitting ? 'Saving...' : 'Save Customer')
                : 'Next'}
            </button>
          ) : isLastStep ? (
            <Button
              variant="primary"
              onClick={handleDynamicNext}
              disabled={submitting}
              isLoading={submitting}
            >
              {submitting ? 'Saving...' : 'Save Customer'}
            </Button>
          ) : (
            <Button variant="primary" onClick={handleDynamicNext}>
              Next
            </Button>
          )
        }
      />
    </div>
  );
}
