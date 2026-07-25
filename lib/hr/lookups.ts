import type { DropdownOption } from '@/components/ui/SearchableDropdown';

/**
 * Shared HR lookup option lists (nationality / home country / religion / gender /
 * marital status / employment type). Single source of truth so the create and
 * edit employee forms show the same populated dropdowns.
 */
export const NATIONALITY_OPTS: DropdownOption[] = [
  'Emirati', 'Egyptian', 'Indian', 'Pakistani', 'Filipino', 'Bangladeshi', 'Sri Lankan', 'Nepali',
  'Jordanian', 'Syrian', 'Lebanese', 'Yemeni', 'Saudi', 'Omani', 'Kuwaiti', 'Bahraini', 'Qatari',
  'Moroccan', 'Sudanese', 'Ethiopian', 'Kenyan', 'British', 'American', 'Canadian', 'Other',
].map(n => ({ value: n, label: n }));

export const HOME_COUNTRY_OPTS: DropdownOption[] = [
  'UAE', 'Egypt', 'India', 'Pakistan', 'Philippines', 'Bangladesh', 'Sri Lanka', 'Nepal',
  'Jordan', 'Syria', 'Lebanon', 'Yemen', 'Saudi Arabia', 'Oman', 'Kuwait', 'Bahrain', 'Qatar',
  'Morocco', 'Sudan', 'Ethiopia', 'Kenya', 'UK', 'USA', 'Canada', 'Other',
].map(c => ({ value: c, label: c }));

export const RELIGION_OPTS: DropdownOption[] = [
  { value: 'Islam', label: 'Islam' }, { value: 'Christianity', label: 'Christianity' },
  { value: 'Hinduism', label: 'Hinduism' }, { value: 'Buddhism', label: 'Buddhism' },
  { value: 'Other', label: 'Other' },
];

export const GENDER_OPTS: DropdownOption[] = [
  { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' },
];

export const MARITAL_OPTS: DropdownOption[] = [
  { value: 'single', label: 'Single' }, { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' }, { value: 'widowed', label: 'Widowed' },
];

export const EMPLOYMENT_TYPE_OPTS: DropdownOption[] = [
  { value: 'full_time', label: 'Full Time' }, { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' }, { value: 'intern', label: 'Intern' },
];
