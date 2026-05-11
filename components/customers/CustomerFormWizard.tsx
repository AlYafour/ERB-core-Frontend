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

const CUSTOMER_TYPES = [
  { value: 'owner',      label: 'Owner (مالك)' },
  { value: 'commercial', label: 'Commercial (تجاري)' },
  { value: 'consultant', label: 'Consultant (استشاري)' },
];

const SKIP_PREFIXES = [
  'authorized_people', 'passport', 'national_id', 'signature',
  'personal_image', 'company_', 'legal_person', 'contact_people',
];

export default function CustomerFormWizard() {
  const router = useRouter();
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

  const handleTypeChange = (value: string) => {
    setCustomerType(value);
    setCurrentStep(0);
    setFormData({});
  };

  const handleSubmit = async () => {
    const payload = new FormData();
    payload.append('customer_type', customerType);

    if (customerType === 'owner') {
      Object.entries(formData).forEach(([key, value]) => {
        // authorized_people is an array — handled separately below, skip here
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
      // Company profile fields
      const companyProfileKeys = [
        'classification', 'postal_code', 'landline_number', 'company_office_address',
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

      // Legal person fields (stored flat in formData, keyed by field.name from legal_person step)
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

      // Contact people array
      const contactPeople = formData.contact_people as Record<string, unknown>[];
      if (Array.isArray(contactPeople) && contactPeople.length > 0) {
        payload.append('company_profile.contact_people', JSON.stringify(contactPeople));
      }
    }

    // Top-level common fields
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

  return (
    <div className="max-w-3xl mx-auto">
      {/* Step indicator */}
      {customerType && steps.length > 0 && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-2 flex-shrink-0">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                  idx < currentStep
                    ? 'bg-green-500 text-white'
                    : idx === currentStep
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-400'
                }`}
                style={idx > currentStep ? { background: 'var(--surface-elevated)', border: '2px solid var(--border)' } : {}}
              >
                {idx < currentStep ? '✓' : idx + 1}
              </div>
              <span
                className="text-xs font-medium hidden sm:block"
                style={{ color: idx === currentStep ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
              >
                {step.label}
              </span>
              {idx < steps.length - 1 && (
                <div className="w-6 h-px" style={{ background: 'var(--border)' }} />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card">
        {/* Type selector */}
        {!customerType && (
          <div>
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Select Customer Type
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {CUSTOMER_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => handleTypeChange(type.value)}
                  className="rounded-lg border-2 p-4 text-center font-medium transition-all hover:border-orange-400 hover:bg-orange-50"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form steps */}
        {customerType && currentStepConfig && (
          <>
            {loadingOptions && (
              <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>Loading options...</p>
            )}

            <DynamicFormStep
              step={currentStepConfig}
              formData={formData}
              setFormData={setFormData}
              options={options}
              loadingOptions={loadingOptions}
            />

            <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex gap-2">
                {currentStep > 0 && (
                  <Button variant="secondary" onClick={() => setCurrentStep((p) => p - 1)}>
                    ← Back
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => {
                    setCustomerType('');
                    setCurrentStep(0);
                    setFormData({});
                  }}
                >
                  Change Type
                </Button>
              </div>

              {!isLastStep ? (
                <Button variant="primary" onClick={() => setCurrentStep((p) => p + 1)}>
                  Next →
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
          </>
        )}
      </div>
    </div>
  );
}
