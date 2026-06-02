export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'date' | 'textarea' | 'select' | 'file' | 'checkbox';
  optionsKey?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
}

export interface FormStep {
  id: string;
  label: string;
  repeatable?: boolean;
  fields: FormField[];
}

const basicFormConfig: FormStep = {
  id: 'basic',
  label: 'Basic Information',
  fields: [
    { name: 'code',                       label: 'Code',                   type: 'text' },
    { name: 'full_name_arabic',           label: 'Full Name (Arabic)',     type: 'text',     required: true },
    { name: 'full_name_english',          label: 'Full Name (English)',    type: 'text',     required: true },
    { name: 'email',                      label: 'Email',                  type: 'email' },
    { name: 'telephone_number',           label: 'Telephone Number',       type: 'text' },
    { name: 'whatsapp_number',            label: 'WhatsApp Number',        type: 'text' },
    { name: 'country',                    label: 'Country',                type: 'select',   optionsKey: 'countries' },
    { name: 'city',                       label: 'City',                   type: 'select',   optionsKey: 'cities' },
    { name: 'area',                       label: 'Area',                   type: 'text' },
    { name: 'bank_account',               label: 'Bank Account',           type: 'text' },
    { name: 'bank_name',                  label: 'Bank Name',              type: 'text' },
    { name: 'account_holder_name',        label: 'Account Holder Name',    type: 'text' },
    { name: 'iban_number',                label: 'IBAN Number',            type: 'text' },
    { name: 'iban_certificate_attachment',label: 'IBAN Certificate',       type: 'file' },
    { name: 'currency',                   label: 'Currency',               type: 'select',   optionsKey: 'currency' },
    { name: 'preferred_language',         label: 'Preferred Language',     type: 'select',   optionsKey: 'languages' },
    { name: 'notes',                      label: 'Notes',                  type: 'textarea' },
  ],
};

export default basicFormConfig;
