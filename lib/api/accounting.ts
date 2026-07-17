import apiClient from './client';
import type { PaginatedResponse } from '@/types';

/**
 * Accounting module API — /api/accounting/*
 * Backend contract: see ERB-core-Backend/docs/accounting/.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AccountNature =
  | 'asset' | 'liability' | 'equity' | 'revenue'
  | 'cogs' | 'expense' | 'other_income' | 'other_expense';

export interface AccountCategory {
  id: number;
  nature: AccountNature;
  code: string;
  name: string;
  name_ar: string;
  display_order: number;
  is_active: boolean;
  accounts_count?: number;
}

export interface GLAccount {
  id: number;
  code: string;
  name: string;
  name_ar: string;
  description: string;
  category: number;
  category_name?: string;
  parent: number | null;
  parent_code?: string | null;
  nature: AccountNature;
  normal_side: 'debit' | 'credit';
  is_postable: boolean;
  is_system: boolean;
  currency: string;
  is_active: boolean;
  opening_balance: string;
  has_activity?: boolean;
}

export interface AccountMappingRow {
  id: number;
  key: string;
  key_label: string;
  account: number;
  account_code: string;
  account_name: string;
}

export interface TaxCode {
  id: number;
  code: string;
  name: string;
  name_ar: string;
  tax_type: string;
  rate: string;
  is_recoverable: boolean;
  is_inclusive: boolean;
  is_active: boolean;
}

export interface FiscalPeriod {
  id: number;
  fiscal_year: number;
  fiscal_year_code: string;
  number: number;
  start_date: string;
  end_date: string;
  status: 'open' | 'soft_closed' | 'hard_closed' | 'locked';
}

export interface FiscalYear {
  id: number;
  code: string;
  start_date: string;
  end_date: string;
  status: 'open' | 'closed';
  periods: FiscalPeriod[];
}

export interface JournalLine {
  id?: number;
  line_no?: number;
  account: number;
  account_code?: string;
  account_name?: string;
  description?: string;
  debit: string;
  credit: string;
  partner_type?: string;
  partner_id?: string;
  project?: number | null;
  cost_code?: number | null;
  department?: number | null;
}

export type JournalStatus =
  | 'draft' | 'pending_review' | 'approved' | 'posted' | 'reversed' | 'cancelled';

export interface JournalEntry {
  id: string;
  number: string;
  entry_type: string;
  status: JournalStatus;
  entry_date: string;
  posting_date: string;
  currency: string;
  memo: string;
  reference: string;
  source_module: string;
  source_id: string;
  event_code: string;
  total_debit: string;
  total_credit: string;
  created_by_name?: string;
  posted_by_name?: string | null;
  reversal_of_number?: string | null;
  lines: JournalLine[];
  created_at: string;
}

export interface PaymentAllocation {
  id?: number;
  target_type: 'purchase_invoice' | 'client_invoice';
  target_id: string;
  amount: string;
}

export interface AccPayment {
  id: string;
  number: string;
  direction: 'in' | 'out';
  method: string;
  payment_date: string;
  amount: string;
  currency: string;
  funds_account: number;
  funds_account_code?: string;
  funds_account_name?: string;
  partner_type: string;
  partner_id: string;
  partner_name: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  reference: string;
  notes: string;
  journal_number?: string | null;
  allocations: PaymentAllocation[];
  allocated_total?: string;
  unallocated?: string;
  created_at: string;
}

export interface BankAccount {
  id: string;
  kind: 'bank' | 'cash' | 'petty_cash';
  name: string;
  name_ar: string;
  bank_name: string;
  account_number: string;
  iban: string;
  currency: string;
  ledger_account: number;
  ledger_account_code?: string;
  ledger_account_name?: string;
  custodian: number | null;
  is_active: boolean;
}

export interface StatementLine {
  id: number;
  line_no: number;
  txn_date: string;
  description: string;
  reference: string;
  amount: string;
  status: 'unmatched' | 'matched';
  matched_journal_line: number | null;
  journal_number?: string | null;
  match_confidence: string;
}

export interface BankStatement {
  id: string;
  bank_account: string;
  bank_account_name?: string;
  reference: string;
  period_start: string | null;
  period_end: string | null;
  status: 'open' | 'reconciled';
  unmatched_count?: number;
  lines: StatementLine[];
  created_at: string;
}

export interface MatchSuggestion {
  line_id: number;
  line_no: number;
  txn_date: string;
  amount: string;
  journal_line_id: number;
  journal_number: string;
  posting_date: string;
  journal_memo: string;
  confidence: 'high' | 'medium';
}

export interface BudgetLine {
  id?: number;
  account: number;
  account_code?: string;
  account_name?: string;
  period: number;
  amount: string;
}

export interface Budget {
  id: string;
  name: string;
  fiscal_year: number;
  fiscal_year_code?: string;
  dimension_type: string;
  dimension_id: string;
  status: 'draft' | 'active' | 'closed';
  alert_threshold_pct: number;
  notes: string;
  lines: BudgetLine[];
}

export interface AccountingSettings {
  id: number;
  base_currency: string;
  fiscal_start_month: number;
  coa_template: string;
  enforce_sod: boolean;
  activated_at: string;
}

export interface SetupStatus {
  activated: boolean;
  settings: AccountingSettings | null;
  templates: { key: string; label: string; label_ar: string }[];
}

export interface DashboardData {
  as_of: string;
  cash: { total: string; accounts: { id: string; name: string; kind: string; balance: string }[] };
  receivables: string | null;
  payables: string | null;
  vat_net: string | null;
  month: { revenue: string; expenses: string; net_profit: string };
  attention: { draft_journals: number; draft_payments: number };
}

// ── API ───────────────────────────────────────────────────────────────────────

// apiClient baseURL already ends with /api — do NOT repeat it here
const BASE = '/accounting';

export const accountingApi = {
  // Setup / settings
  getSetup: () =>
    apiClient.get<SetupStatus>(`${BASE}/setup/`).then(r => r.data),
  activate: (payload: { template: string; fiscal_start_month: number; base_currency: string; fiscal_year?: number }) =>
    apiClient.post<AccountingSettings>(`${BASE}/setup/`, payload).then(r => r.data),
  getSettings: () =>
    apiClient.get<AccountingSettings>(`${BASE}/settings/`).then(r => r.data),
  updateSettings: (payload: Partial<AccountingSettings>) =>
    apiClient.patch<AccountingSettings>(`${BASE}/settings/`, payload).then(r => r.data),
  getDashboard: () =>
    apiClient.get<DashboardData>(`${BASE}/dashboard/`).then(r => r.data),

  // Chart of accounts
  listCategories: (params?: Record<string, unknown>) =>
    apiClient.get<PaginatedResponse<AccountCategory>>(`${BASE}/categories/`, { params: { page_size: 200, ...params } }).then(r => r.data),
  createCategory: (payload: Partial<AccountCategory>) =>
    apiClient.post<AccountCategory>(`${BASE}/categories/`, payload).then(r => r.data),
  updateCategory: (id: number, payload: Partial<AccountCategory>) =>
    apiClient.patch<AccountCategory>(`${BASE}/categories/${id}/`, payload).then(r => r.data),
  listAccounts: (params?: Record<string, unknown>) =>
    apiClient.get<PaginatedResponse<GLAccount>>(`${BASE}/accounts/`, { params }).then(r => r.data),
  createAccount: (payload: Partial<GLAccount>) =>
    apiClient.post<GLAccount>(`${BASE}/accounts/`, payload).then(r => r.data),
  updateAccount: (id: number, payload: Partial<GLAccount>) =>
    apiClient.patch<GLAccount>(`${BASE}/accounts/${id}/`, payload).then(r => r.data),
  deleteAccount: (id: number) =>
    apiClient.delete(`${BASE}/accounts/${id}/`),
  accountBalance: (id: number, asOf?: string) =>
    apiClient.get<{ account: string; normal_side: string; balance: string }>(
      `${BASE}/accounts/${id}/balance/`, { params: asOf ? { as_of: asOf } : {} }).then(r => r.data),

  // Mappings / tax / rules
  listMappings: () =>
    apiClient.get<PaginatedResponse<AccountMappingRow>>(`${BASE}/mappings/`, { params: { page_size: 100 } }).then(r => r.data),
  updateMapping: (id: number, account: number) =>
    apiClient.patch<AccountMappingRow>(`${BASE}/mappings/${id}/`, { account }).then(r => r.data),
  createMapping: (payload: { key: string; account: number }) =>
    apiClient.post<AccountMappingRow>(`${BASE}/mappings/`, payload).then(r => r.data),
  listTaxCodes: () =>
    apiClient.get<PaginatedResponse<TaxCode>>(`${BASE}/tax-codes/`, { params: { page_size: 100 } }).then(r => r.data),
  createTaxCode: (payload: Partial<TaxCode>) =>
    apiClient.post<TaxCode>(`${BASE}/tax-codes/`, payload).then(r => r.data),
  updateTaxCode: (id: number, payload: Partial<TaxCode>) =>
    apiClient.patch<TaxCode>(`${BASE}/tax-codes/${id}/`, payload).then(r => r.data),
  listPostingRules: () =>
    apiClient.get<PaginatedResponse<{ id: number; event_code: string; behavior: string; is_active: boolean }>>(
      `${BASE}/posting-rules/`, { params: { page_size: 100 } }).then(r => r.data),
  savePostingRule: (payload: { id?: number; event_code: string; behavior: string; is_active?: boolean }) =>
    payload.id
      ? apiClient.patch(`${BASE}/posting-rules/${payload.id}/`, payload).then(r => r.data)
      : apiClient.post(`${BASE}/posting-rules/`, payload).then(r => r.data),

  // Fiscal
  listFiscalYears: () =>
    apiClient.get<PaginatedResponse<FiscalYear>>(`${BASE}/fiscal-years/`, { params: { page_size: 50 } }).then(r => r.data),
  createFiscalYear: (year: number) =>
    apiClient.post(`${BASE}/fiscal-years/create-year/`, { year }).then(r => r.data),
  closePeriod: (id: number, hard = false, reason = '') =>
    apiClient.post(`${BASE}/fiscal-periods/${id}/close/`, { hard, reason }).then(r => r.data),
  reopenPeriod: (id: number, reason: string) =>
    apiClient.post(`${BASE}/fiscal-periods/${id}/reopen/`, { reason }).then(r => r.data),
  closingChecklist: (fiscalYearId: number) =>
    apiClient.get(`${BASE}/year-end-close/`, { params: { fiscal_year: fiscalYearId } }).then(r => r.data),
  closeFiscalYear: (fiscalYearId: number) =>
    apiClient.post(`${BASE}/year-end-close/`, { fiscal_year: fiscalYearId }).then(r => r.data),

  // Journal
  listJournal: (params?: Record<string, unknown>) =>
    apiClient.get<PaginatedResponse<JournalEntry>>(`${BASE}/journal-entries/`, { params }).then(r => r.data),
  getJournal: (id: string) =>
    apiClient.get<JournalEntry>(`${BASE}/journal-entries/${id}/`).then(r => r.data),
  createJournal: (payload: Partial<JournalEntry>) =>
    apiClient.post<JournalEntry>(`${BASE}/journal-entries/`, payload).then(r => r.data),
  updateJournal: (id: string, payload: Partial<JournalEntry>) =>
    apiClient.patch<JournalEntry>(`${BASE}/journal-entries/${id}/`, payload).then(r => r.data),
  postJournal: (id: string) =>
    apiClient.post<JournalEntry>(`${BASE}/journal-entries/${id}/post/`).then(r => r.data),
  bulkPostJournals: (payload: { ids?: string[]; all_drafts?: boolean }) =>
    apiClient.post<{ posted: number; skipped: Array<{ id: string; memo: string; reason: string }>; errors: Array<{ id: string; memo: string; error: string }> }>(
      `${BASE}/journal-entries/bulk-post/`, payload).then(r => r.data),
  reverseJournal: (id: string, reason: string) =>
    apiClient.post<JournalEntry>(`${BASE}/journal-entries/${id}/reverse/`, { reason }).then(r => r.data),
  trialBalance: (params?: { date_from?: string; date_to?: string }) =>
    apiClient.get(`${BASE}/journal-entries/trial-balance/`, { params }).then(r => r.data),

  // Payments
  listPayments: (params?: Record<string, unknown>) =>
    apiClient.get<PaginatedResponse<AccPayment>>(`${BASE}/payments/`, { params }).then(r => r.data),
  createPayment: (payload: Partial<AccPayment>) =>
    apiClient.post<AccPayment>(`${BASE}/payments/`, payload).then(r => r.data),
  updatePayment: (id: string, payload: Partial<AccPayment>) =>
    apiClient.patch<AccPayment>(`${BASE}/payments/${id}/`, payload).then(r => r.data),
  confirmPayment: (id: string) =>
    apiClient.post<AccPayment>(`${BASE}/payments/${id}/confirm/`).then(r => r.data),
  cancelPayment: (id: string, reason: string) =>
    apiClient.post<AccPayment>(`${BASE}/payments/${id}/cancel/`, { reason }).then(r => r.data),
  deletePayment: (id: string) =>
    apiClient.delete(`${BASE}/payments/${id}/`),

  // Banking
  listBankAccounts: (params?: Record<string, unknown>) =>
    apiClient.get<PaginatedResponse<BankAccount>>(`${BASE}/bank-accounts/`, { params: { page_size: 100, ...params } }).then(r => r.data),
  createBankAccount: (payload: Partial<BankAccount>) =>
    apiClient.post<BankAccount>(`${BASE}/bank-accounts/`, payload).then(r => r.data),
  updateBankAccount: (id: string, payload: Partial<BankAccount>) =>
    apiClient.patch<BankAccount>(`${BASE}/bank-accounts/${id}/`, payload).then(r => r.data),
  transfer: (sourceId: string, payload: { destination: string; amount: string; transfer_date?: string; reference?: string; memo?: string }) =>
    apiClient.post(`${BASE}/bank-accounts/${sourceId}/transfer/`, payload).then(r => r.data),
  listStatements: (params?: Record<string, unknown>) =>
    apiClient.get<PaginatedResponse<BankStatement>>(`${BASE}/bank-statements/`, { params }).then(r => r.data),
  importStatement: (payload: { bank_account: string; content?: string; format?: 'csv' | 'ofx'; filename?: string; reference?: string }) =>
    apiClient.post<{ statement: BankStatement; imported: number; skipped: number }>(
      `${BASE}/bank-statements/import/`, payload).then(r => r.data),
  suggestMatches: (statementId: string) =>
    apiClient.get<{ suggestions: MatchSuggestion[] }>(`${BASE}/bank-statements/${statementId}/suggest/`).then(r => r.data),
  matchLine: (statementId: string, line: number, journalLine: number, confidence?: string) =>
    apiClient.post<BankStatement>(`${BASE}/bank-statements/${statementId}/match/`,
      { line, journal_line: journalLine, confidence }).then(r => r.data),
  unmatchLine: (statementId: string, line: number, reason?: string) =>
    apiClient.post<BankStatement>(`${BASE}/bank-statements/${statementId}/unmatch/`, { line, reason }).then(r => r.data),
  reconcileStatement: (statementId: string) =>
    apiClient.post<BankStatement>(`${BASE}/bank-statements/${statementId}/reconcile/`).then(r => r.data),
  reopenStatement: (statementId: string, reason: string) =>
    apiClient.post<BankStatement>(`${BASE}/bank-statements/${statementId}/reopen/`, { reason }).then(r => r.data),

  // Fixed assets
  listAssets: (params?: Record<string, unknown>) =>
    apiClient.get(`${BASE}/fixed-assets/`, { params }).then(r => r.data),
  createAsset: (payload: Record<string, unknown>) =>
    apiClient.post(`${BASE}/fixed-assets/`, payload).then(r => r.data),
  activateAsset: (id: number) =>
    apiClient.post(`${BASE}/fixed-assets/${id}/activate/`).then(r => r.data),
  disposeAsset: (id: number, payload: { disposal_date: string; proceeds: string; reason: string }) =>
    apiClient.post(`${BASE}/fixed-assets/${id}/dispose/`, payload).then(r => r.data),
  runDepreciation: (period?: string) =>
    apiClient.post(`${BASE}/fixed-assets/run-depreciation/`, period ? { period } : {}).then(r => r.data),

  // Reports
  balanceSheet: (asOf?: string) =>
    apiClient.get(`${BASE}/reports/balance-sheet/`, { params: asOf ? { as_of: asOf } : {} }).then(r => r.data),
  profitLoss: (params?: Record<string, unknown>) =>
    apiClient.get(`${BASE}/reports/profit-loss/`, { params }).then(r => r.data),
  cashFlow: (params?: Record<string, unknown>) =>
    apiClient.get(`${BASE}/reports/cash-flow/`, { params }).then(r => r.data),
  vatReturn: (params?: Record<string, unknown>) =>
    apiClient.get(`${BASE}/reports/vat-return/`, { params }).then(r => r.data),
  accountLedger: (accountId: number, params?: Record<string, unknown>) =>
    apiClient.get(`${BASE}/reports/account-ledger/`, { params: { account: accountId, ...params } }).then(r => r.data),
  apAging: (params?: Record<string, unknown>) =>
    apiClient.get(`${BASE}/ap/aging/`, { params }).then(r => r.data),
  arAging: (params?: Record<string, unknown>) =>
    apiClient.get(`${BASE}/ar/aging/`, { params }).then(r => r.data),
  supplierStatement: (supplierId: string, params?: Record<string, unknown>) =>
    apiClient.get(`${BASE}/ap/supplier-statement/`, { params: { supplier_id: supplierId, ...params } }).then(r => r.data),
  customerStatement: (customerId: string, params?: Record<string, unknown>) =>
    apiClient.get(`${BASE}/ar/customer-statement/`, { params: { customer_id: customerId, ...params } }).then(r => r.data),
  inventoryValuation: () =>
    apiClient.get(`${BASE}/inventory/valuation/`).then(r => r.data),

  // Budgets / FX / import
  listBudgets: (params?: Record<string, unknown>) =>
    apiClient.get<PaginatedResponse<Budget>>(`${BASE}/budgets/`, { params }).then(r => r.data),
  createBudget: (payload: Partial<Budget>) =>
    apiClient.post<Budget>(`${BASE}/budgets/`, payload).then(r => r.data),
  activateBudget: (id: string) =>
    apiClient.post<Budget>(`${BASE}/budgets/${id}/activate/`).then(r => r.data),
  budgetVariance: (id: string) =>
    apiClient.get(`${BASE}/budgets/${id}/variance/`).then(r => r.data),
  listExchangeRates: (params?: Record<string, unknown>) =>
    apiClient.get(`${BASE}/exchange-rates/`, { params }).then(r => r.data),
  createExchangeRate: (payload: { currency: string; rate_date: string; rate: string }) =>
    apiClient.post(`${BASE}/exchange-rates/`, payload).then(r => r.data),
  revalueFx: (asOf?: string) =>
    apiClient.post(`${BASE}/fx/revalue/`, asOf ? { as_of: asOf } : {}).then(r => r.data),
  previewPurchaseInvoice: (invoiceId: number) =>
    apiClient.get(`${BASE}/preview/purchase-invoice/${invoiceId}/`).then(r => r.data),
  listCostCodes: (params?: Record<string, unknown>) =>
    apiClient.get<{ id: number; qb_code: string; excel_code: string;
      description: string; level: number; parent: number | null;
      default_account: number | null; default_account_code?: string | null;
      effective_account_code?: string | null }[]>(
      '/cost-codes/', { params }).then(r => r.data),
  setCostCodeAccount: (id: number, account: number | null) =>
    apiClient.patch(`/cost-codes/${id}/`, { default_account: account }).then(r => r.data),
  getOpeningBalance: () =>
    apiClient.get(`${BASE}/opening-balance/`).then(r => r.data),
  createOpeningBalance: (payload: { as_of: string; rows: Record<string, unknown>[] }) =>
    apiClient.post(`${BASE}/opening-balance/`, payload).then(r => r.data),
  importQuickBooksCoA: (content: string) =>
    apiClient.post(`${BASE}/import/quickbooks-coa/`, { content }).then(r => r.data),
};

export default accountingApi;
