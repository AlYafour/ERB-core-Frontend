import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '@/lib/api/accounting';

/**
 * The tenant's base (functional) currency, chosen at accounting activation.
 * Falls back to 'AED' until settings load or when accounting isn't active.
 * Use with formatMoney() so money displays follow the tenant, not a hardcoded
 * jurisdiction.
 */
export function useBaseCurrency(): string {
  const { data } = useQuery({
    queryKey: ['acc-base-currency'],
    queryFn: () => accountingApi.getSetup(),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return data?.settings?.base_currency || 'AED';
}
