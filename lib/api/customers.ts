import apiClient from './client';

const BASE = '/customers/';

export interface Customer {
  id: number;
  code: string;
  full_name_english: string;
  full_name_arabic: string;
  email: string;
  telephone_number: string;
  whatsapp_number: string;
  customer_type: 'owner' | 'commercial' | 'consultant';
  status: string;
  delete_requested?: boolean;
  preferred_language?: string;
}

export interface CustomerListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Customer[];
}

export interface SharedOptions {
  countries: { value: string | number; label: string }[];
  cities: { value: string | number; label: string }[];
  genders: { value: string | number; label: string }[];
  nationalities: { value: string | number; label: string }[];
  communicationMethods: { value: string | number; label: string }[];
  billing: { value: string | number; label: string }[];
  currency: { value: string | number; label: string }[];
  languages: { value: string; label: string }[];
  classification: { value: string | number; label: string }[];
}

type LookupItem = { id: number; name_en: string; name_ar: string; code?: string };

function toOptions(items: LookupItem[]): { value: number; label: string }[] {
  return items.map((i) => ({ value: i.id, label: i.name_en || i.name_ar }));
}

const LANGUAGES: { value: string; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic (العربية)' },
];

export const customersApi = {
  getAll: async (params?: Record<string, unknown>): Promise<CustomerListResponse> => {
    const res = await apiClient.get(BASE, { params });
    return res.data;
  },

  getOne: async (id: number): Promise<Customer> => {
    const res = await apiClient.get(`${BASE}${id}/`);
    return res.data;
  },

  create: async (data: FormData): Promise<Customer> => {
    const res = await apiClient.post(BASE, data);
    return res.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`${BASE}${id}/`);
  },

  getSharedOptions: async (): Promise<Partial<SharedOptions>> => {
    try {
      const LOOKUPS = '/client-lookups/';
      const [countries, cities, genders, nationalities, commMethods, billings, currencies, classifications] =
        await Promise.all([
          apiClient.get<LookupItem[]>(`${LOOKUPS}countries/`),
          apiClient.get<LookupItem[]>(`${LOOKUPS}cities/`),
          apiClient.get<LookupItem[]>(`${LOOKUPS}genders/`),
          apiClient.get<LookupItem[]>(`${LOOKUPS}nationalities/`),
          apiClient.get<LookupItem[]>(`${LOOKUPS}communication-methods/`),
          apiClient.get<LookupItem[]>(`${LOOKUPS}billings/`),
          apiClient.get<LookupItem[]>(`${LOOKUPS}currencies/`),
          apiClient.get<LookupItem[]>(`${LOOKUPS}classifications/`),
        ]);

      const unwrap = (res: { data: LookupItem[] | { results?: LookupItem[] } }) =>
        Array.isArray(res.data) ? res.data : (res.data as { results?: LookupItem[] }).results ?? [];

      return {
        countries:          toOptions(unwrap(countries)),
        cities:             toOptions(unwrap(cities)),
        genders:            toOptions(unwrap(genders)),
        nationalities:      toOptions(unwrap(nationalities)),
        communicationMethods: toOptions(unwrap(commMethods)),
        billing:            toOptions(unwrap(billings)),
        currency:           toOptions(unwrap(currencies)),
        classification:     toOptions(unwrap(classifications)),
        languages:          LANGUAGES,
      };
    } catch {
      return { languages: LANGUAGES };
    }
  },
};
