'use client';

import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { Button } from '@/components/ui';
import { useT } from '@/lib/i18n/useT';

export interface AddItemState {
  product_id: number;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  notes: string;
}

interface Props {
  value: AddItemState;
  onChange: (s: AddItemState) => void;
  onAdd: () => void;
  productOptions: { value: number; label: string; searchText?: string }[];
  showTaxRate?: boolean;
}

export function AddItemPanel({ value, onChange, onAdd, productOptions, showTaxRate = false }: Props) {
  const t = useT();
  const canAdd = !!value.product_id && value.quantity > 0 && value.unit_price > 0;

  const set = (patch: Partial<AddItemState>) => onChange({ ...value, ...patch });
  const num = (v: string) => parseFloat(v) || 0;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: 'var(--space-3)',
      padding: 'var(--space-4)',
      background: 'var(--surface-subtle)',
      borderRadius: 'var(--radius-md)',
      marginBottom: 'var(--space-4)',
    }}>
      <div style={{ gridColumn: 'span 2' }}>
        <SearchableDropdown
          options={productOptions}
          value={value.product_id}
          onChange={(v) => set({ product_id: v ? Number(v) : 0 })}
          placeholder={t('col', 'product')}
          searchPlaceholder="Search products…"
        />
      </div>

      <div>
        <label className="form-label">{t('col', 'quantity')}</label>
        <input type="number" min="0" step="any" className="form-input"
          value={value.quantity || ''}
          onChange={(e) => set({ quantity: num(e.target.value) })} />
      </div>

      <div>
        <label className="form-label">{t('col', 'unitPrice')}</label>
        <input type="number" min="0" step="0.01" className="form-input"
          value={value.unit_price || ''}
          onChange={(e) => set({ unit_price: num(e.target.value) })} />
      </div>

      <div>
        <label className="form-label">{t('col', 'discountPct')}</label>
        <input type="number" min="0" max="100" step="0.01" className="form-input"
          value={value.discount || ''}
          onChange={(e) => set({ discount: num(e.target.value) })} />
      </div>

      {showTaxRate && (
        <div>
          <label className="form-label">{t('col', 'taxPct')}</label>
          <input type="number" min="0" max="100" step="0.01" className="form-input"
            value={value.tax_rate || ''}
            onChange={(e) => set({ tax_rate: num(e.target.value) })} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <Button type="button" variant="primary" style={{ width: '100%' }}
          onClick={onAdd} disabled={!canAdd}>
          + {t('btn', 'addProduct')}
        </Button>
      </div>
    </div>
  );
}
