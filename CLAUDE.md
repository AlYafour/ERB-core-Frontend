# ERB Frontend — Design System & Conventions

These rules keep the app visually and structurally consistent. They are
**binding**: when a rule and an old page disagree, the page is wrong — fix the
page, do not fork the rule.

## The golden rule: one component per job, no per-page chrome

There is exactly **one** component for each recurring surface. Never build a
page-local variant, never copy a component "to tweak it", never add a per-page
`.css` file. If a shared component can't do what a page needs, extend the
shared component (add a prop) — do not work around it locally.

## List pages → `AppListPage`

Every list/index page uses **`AppListPage`** (`components/app/AppListPage.tsx`).
It is the ONLY list rendering path in the app.

- `ProcListPage` is a thin adapter that delegates to `AppListPage` — existing
  procurement call sites keep working; new pages import `AppListPage` directly.
- `EnterpriseListPage`/`EnterpriseTable` were deleted (2026-07-17). Do not
  reintroduce them.
- State comes from **`useTableState`** (`lib/hooks/use-table-state.ts`) —
  never `useListState` (deleted). It persists page/search/filters/sort/scroll
  to sessionStorage and powers cross-page selection.
- Columns are `Column<T>` from `@/components/ui` (requires `render`; sortable
  columns set `sortKey`). Right-align numeric cells with an inline
  `{ display:'block', textAlign:'right', fontFamily:'monospace' }` span.
- Status tabs: pass `statusItems` (and `statusKey` if the filter key isn't
  `status`). Financial totals go in `totalAmount` + `totalAmountLabel`.
- Bulk actions: pass `bulkActions` as a ReactNode of `<Button>`s; selection
  comes from `tableState.selectedItems`.
- Row navigation via `onRowClick`; inside a row, wrap interactive controls in
  an element with `onClick={e => e.stopPropagation()}`.

## Detail pages → `PageHeader` + `card` sections

Every detail page uses **`PageHeader`** (`components/ui/PageHeader.tsx`) for the
title/breadcrumbs/back/actions bar, then content in `card` blocks. Section
headers use `proc-section-head` + `proc-section-title`; label/value grids use
`proc-info-grid` with the shared `ProcField`
(`components/procurement/shared/ProcField.tsx`). The `JournalEntryEditor` and
purchase-invoice detail are the reference implementations.

## Forms

Reuse `SearchableDropdown`, `DateInput`, `FormField`, `Button`. Creatable
dropdowns use `onCreateOption`. Never hand-roll a `<select>`/date input when a
shared control exists.

## Styling tokens — never hardcode

Use CSS variables for every color, space and radius:
`var(--text-primary|secondary|tertiary)`, `var(--brand)`,
`var(--status-error|warning|success)` (+ `-bg`/`-border`),
`var(--border-subtle)`, `var(--surface-primary)`, `var(--space-*)`,
`var(--radius-*)`, `var(--text-xs|sm|md|lg|xl)`, `var(--weight-*)`. No raw hex,
no px font sizes. No per-page CSS files — global tokens + inline styles only.

## Errors & toasts

- `toast(message, 'success' | 'error' | 'info')` — never `toast.success(...)`.
- Async confirms: `await confirm(...)` from `@/lib/hooks/use-toast` — never
  `window.confirm/alert/prompt`.
- API errors: `getApiError(err, 'fallback')` from `@/lib/utils/error` — never
  hand-parse `err.response.data` (it crashed the employee form with
  `a.flat is not a function`).

## Button variants

`primary | secondary | ghost | destructive | success | view | edit | delete`.
Use `destructive` for delete (not `danger`); `RowActions` items use
`variant: 'danger'`.

## Accounting ↔ source-document linkage

Accounting is soft-coupled: serializer fields that read the ledger
(`PurchaseInvoice.journal_entry`) must never crash when accounting is off.
Detail pages cross-link both ways (invoice ↔ journal entry). Terms &
Conditions have ONE source — company branding — and render on the printed LPO
only, never on screens or per-document copies.

## Build discipline

`npx tsc --noEmit` then `npx next build` before committing. Pre-existing TS
errors unrelated to your change (some `approval_status` / reports pages) are
tolerated by `ignoreBuildErrors`; do not add new ones. Push to `main` only.
