import basicFormConfig, { FormStep } from './basicFormConfig';

const ownerFormConfig: { steps: FormStep[] } = {
  steps: [
    basicFormConfig,

    {
      id: 'owner_profile',
      label: 'Owner Profile',
      fields: [
        { name: 'birth_date',                 label: 'Birth Date',              type: 'date' },
        { name: 'home_address',               label: 'Home Address',            type: 'text' },
        { name: 'gender',                     label: 'Gender',                  type: 'select', optionsKey: 'genders' },
        { name: 'nationality',                label: 'Nationality',             type: 'select', optionsKey: 'nationalities' },
        { name: 'national_id_number',         label: 'National ID Number',      type: 'text' },
        { name: 'national_id_attachment',     label: 'National ID Attachment',  type: 'file' },
        { name: 'national_id_expiry_date',    label: 'National ID Expiry Date', type: 'date' },
        { name: 'passport_number',            label: 'Passport Number',         type: 'text' },
        { name: 'passport_attachment',        label: 'Passport Attachment',     type: 'file' },
        { name: 'passport_expiry_date',       label: 'Passport Expiry Date',    type: 'date' },
        { name: 'signature_attachment',       label: 'Signature',               type: 'file' },
        { name: 'personal_image_attachment',  label: 'Personal Image',          type: 'file' },
        { name: 'communication_method',       label: 'Communication Method',    type: 'select', optionsKey: 'communicationMethods' },
        { name: 'billing',                    label: 'Billing',                 type: 'select', optionsKey: 'billing' },
      ],
    },

    {
      id: 'authorized_people',
      label: 'Authorized Person',
      repeatable: true,
      fields: [
        { name: 'code',                           label: 'Code',                     type: 'text' },
        { name: 'name_ar',                        label: 'Full Name (Arabic)',        type: 'text', required: true },
        { name: 'name_en',                        label: 'Full Name (English)',       type: 'text', required: true },
        { name: 'email',                          label: 'Email',                    type: 'email' },
        { name: 'telephone_number',               label: 'Telephone Number',         type: 'text' },
        { name: 'whatsapp_number',                label: 'WhatsApp Number',          type: 'text' },
        { name: 'country',                        label: 'Country',                  type: 'select', optionsKey: 'countries' },
        { name: 'city',                           label: 'City',                     type: 'select', optionsKey: 'cities' },
        { name: 'area',                           label: 'Area',                     type: 'text' },
        { name: 'birth_date',                     label: 'Birth Date',               type: 'date' },
        { name: 'home_address',                   label: 'Home Address',             type: 'text' },
        { name: 'gender',                         label: 'Gender',                   type: 'select', optionsKey: 'genders' },
        { name: 'nationality',                    label: 'Nationality',              type: 'select', optionsKey: 'nationalities' },
        { name: 'national_id_number',             label: 'National ID Number',       type: 'text' },
        { name: 'national_id_attachment',         label: 'National ID Attachment',   type: 'file' },
        { name: 'national_id_expiry_date',        label: 'National ID Expiry Date',  type: 'date' },
        { name: 'passport_number',                label: 'Passport Number',          type: 'text' },
        { name: 'passport_attachment',            label: 'Passport Attachment',      type: 'file' },
        { name: 'passport_expiry_date',           label: 'Passport Expiry Date',     type: 'date' },
        { name: 'power_of_attorney_attachment',   label: 'Power of Attorney',        type: 'file' },
        { name: 'power_of_attorney_expiry_date',  label: 'PoA Expiry Date',          type: 'date' },
        { name: 'signature_attachment',           label: 'Signature',                type: 'file' },
        { name: 'personal_image_attachment',      label: 'Personal Image',           type: 'file' },
      ],
    },
  ],
};

export default ownerFormConfig;
