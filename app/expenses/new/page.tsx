'use client';

import RouteGuard from '@/components/auth/RouteGuard';
import ExpenseForm from '@/components/expenses/ExpenseForm';

export default function NewExpensePage() {
  return (
    <RouteGuard requiredPermission={{ category: 'expense', action: 'create' }} redirectTo="/expenses">
      <ExpenseForm />
    </RouteGuard>
  );
}
