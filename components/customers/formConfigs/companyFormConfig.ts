import basicFormConfig, { FormStep } from './basicFormConfig';

const companyFormConfig: { steps: FormStep[] } = {
  steps: [
    basicFormConfig,

    {
      id: 'company_profile',
      label: 'Company Profile',
      fields: [
        { name: 'classification',                       label: 'Classification',               type: 'select',   optionsKey: 'classification' },
        { name: 'postal_code',                          label: 'Postal Code',                  type: 'text' },
        { name: 'landline_number',                      label: 'Landline Number',              type: 'text' },
        { name: 'company_office_address',               label: 'Company Address',              type: 'textarea' },
        { name: 'company_logo_attachment',              label: 'Company Logo',                 type: 'file' },
        { name: 'company_trade_license_number',         label: 'Trade License Number',         type: 'text' },
        { name: 'company_trade_license_attachment',     label: 'Trade License Attachment',     type: 'file' },
        { name: 'company_trade_license_expiry_date',    label: 'Trade License Expiry Date',    type: 'date' },
        { name: 'company_stamp_attachment',             label: 'Company Stamp',                type: 'file' },
        { name: 'company_establishment_date',           label: 'Establishment Date',           type: 'date' },
        { name: 'area',                                 label: 'Area',                         type: 'text' },
        { name: 'map_location',                         label: 'Map Location',                 type: 'text' },
      ],
    },

    {
      id: 'legal_person',
      label: 'Legal Person',
      fields: [
        { name: 'code',                         label: 'Code',                     type: 'text' },
        { name: 'name_ar',                      label: 'Full Name (Arabic)',        type: 'text', required: true },
        { name: 'name_en',                      label: 'Full Name (English)',       type: 'text', required: true },
        { name: 'notes',                        label: 'Notes',                    type: 'textarea' },
        { name: 'email',                        label: 'Email',                    type: 'email' },
        { name: 'telephone_number',             label: 'Telephone Number',         type: 'text' },
        { name: 'whatsapp_number',              label: 'WhatsApp Number',          type: 'text' },
        { name: 'country',                      label: 'Country',                  type: 'select', optionsKey: 'countries' },
        { name: 'city',                         label: 'City',                     type: 'select', optionsKey: 'cities' },
        { name: 'area',                         label: 'Area',                     type: 'text' },
        { name: 'birth_date',                   label: 'Birth Date',               type: 'date' },
        { name: 'home_address',                 label: 'Home Address',             type: 'text' },
        { name: 'gender',                       label: 'Gender',                   type: 'select', optionsKey: 'genders' },
        { name: 'nationality',                  label: 'Nationality',              type: 'select', optionsKey: 'nationalities' },
        { name: 'job_title',                    label: 'Job Title',                type: 'text' },
        { name: 'national_id_number',           label: 'National ID Number',       type: 'text' },
        { name: 'national_id_attachment',       label: 'National ID Attachment',   type: 'file' },
        { name: 'national_id_expiry_date',      label: 'National ID Expiry Date',  type: 'date' },
        { name: 'passport_number',              label: 'Passport Number',          type: 'text' },
        { name: 'passport_attachment',          label: 'Passport Attachment',      type: 'file' },
        { name: 'passport_expiry_date',         label: 'Passport Expiry Date',     type: 'date' },
        { name: 'power_of_attorney_attachment', label: 'Power of Attorney',        type: 'file' },
        { name: 'power_of_attorney_expiry_date',label: 'PoA Expiry Date',          type: 'date' },
        { name: 'signature_attachment',         label: 'Signature',                type: 'file' },
        { name: 'personal_image_attachment',    label: 'Personal Image',           type: 'file' },
      ],
    },

    {
      id: 'contact_people',
      label: 'Contact People',
      repeatable: true,
      fields: [
        { name: 'code',              label: 'Code',               type: 'text' },
        { name: 'name_ar',           label: 'Full Name (Arabic)', type: 'text', required: true },
        { name: 'name_en',           label: 'Full Name (English)',type: 'text', required: true },
        { name: 'notes',             label: 'Notes',              type: 'textarea' },
        { name: 'email',             label: 'Email',              type: 'email' },
        { name: 'telephone_number',  label: 'Telephone Number',   type: 'text' },
        { name: 'whatsapp_number',   label: 'WhatsApp Number',    type: 'text' },
        { name: 'country',           label: 'Country',            type: 'select', optionsKey: 'countries' },
        { name: 'city',              label: 'City',               type: 'select', optionsKey: 'cities' },
        { name: 'area',              label: 'Area',               type: 'text' },
        { name: 'job_title',         label: 'Job Title',          type: 'text' },
        { name: 'is_primary',        label: 'Primary Contact',    type: 'checkbox' },
      ],
    },
  ],
};

export default companyFormConfig;
